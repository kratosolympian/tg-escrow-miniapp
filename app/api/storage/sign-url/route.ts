export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClientWithCookies, createServiceRoleClient } from '@/lib/supabaseServer'
import { requireAuth, canAccessEscrow } from '@/lib/rbac'
import { z } from 'zod'
import { SupabaseClient } from '@supabase/supabase-js';
import { Profile } from '@/lib/types';

const signUrlSchema = z.object({
  path: z.string().min(1),
  bucket: z.enum(['product-images', 'receipts'])
})

// Extract shared logic for signed URL generation
async function generateSignedUrl(serviceClient: SupabaseClient, bucket: string, path: string): Promise<string> {
  const { data, error } = await serviceClient.storage
    .from(bucket)
    .createSignedUrl(path, 900); // 15 minutes

  if (error) {
    console.error('Error creating signed URL:', error);
    throw new Error('Failed to create signed URL');
  }

  return data.signedUrl;
}

// Buyer-specific handler
async function buyerHandler(
  request: NextRequest,
  profile: Profile,
  serviceClient: SupabaseClient
): Promise<NextResponse> {
  const body = await request.json();
  const { path, bucket } = signUrlSchema.parse(body);

  // Buyers can access receipts and product images (for escrows they are part of)
  if (bucket === 'receipts') {
    const pathParts = path.split('/');
    if (pathParts.length < 2) {
      return NextResponse.json({ error: 'Invalid path format' }, { status: 400 });
    }

    const escrowId = pathParts[0];
    const { data: escrow } = await serviceClient
      .from('escrows')
      .select('buyer_id')
      .eq('id', escrowId)
      .single();

    if (!escrow || escrow.buyer_id !== profile.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
  } else if (bucket === 'product-images') {
    // Buyers can access product images for escrows they are part of
    const pathParts = path.split('/');
    if (pathParts.length < 2) {
      return NextResponse.json({ error: 'Invalid path format' }, { status: 400 });
    }

    const sellerId = pathParts[0];
    const fileName = pathParts[1];

    // Check if buyer is part of any escrow with this seller and product image
    const { data: escrow } = await serviceClient
      .from('escrows')
      .select('id, buyer_id, product_image_url')
      .eq('seller_id', sellerId)
      .eq('buyer_id', profile.id)
      .eq('product_image_url', `${sellerId}/${fileName}`)
      .single();

    if (!escrow) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
  } else {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const signedUrl = await generateSignedUrl(serviceClient, bucket, path);
  return NextResponse.json({ signedUrl });
}

// Seller-specific handler
async function sellerHandler(
  request: NextRequest,
  profile: Profile,
  serviceClient: SupabaseClient
): Promise<NextResponse> {
  const body = await request.json();
  const { path, bucket } = signUrlSchema.parse(body);

  if (bucket !== 'product-images') {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const pathParts = path.split('/');
  if (pathParts.length < 2 || pathParts[0] !== profile.id) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const signedUrl = await generateSignedUrl(serviceClient, bucket, path);
  return NextResponse.json({ signedUrl });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClientWithCookies();
    const serviceClient = createServiceRoleClient();
    const profile = await requireAuth(supabase);

    if (profile.role === 'buyer') {
      return buyerHandler(request, profile, serviceClient);
    } else if (profile.role === 'seller') {
      return sellerHandler(request, profile, serviceClient);
    } else {
      return NextResponse.json({ error: 'Role not supported' }, { status: 403 });
    }
  } catch (error) {
    // Handle common expected errors more gracefully
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input data' }, { status: 400 })
    }
    // Authentication failures are expected for anonymous requests; return 401 instead of 500
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    console.error('Sign URL error:', error)
    return NextResponse.json({ error: 'Failed to create signed URL' }, { status: 500 })
  }
}
