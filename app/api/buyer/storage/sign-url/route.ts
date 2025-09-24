export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithCookies, createServiceRoleClient } from '@/lib/supabaseServer';
import { requireAuth, canAccessEscrow } from '@/lib/rbac';
import { z } from 'zod';

const signUrlSchema = z.object({
  path: z.string().min(1),
  bucket: z.enum(['product-images', 'receipts']),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClientWithCookies();
    const serviceClient = createServiceRoleClient();

    // Require authentication
    const profile = await requireAuth(supabase);
    console.log('Authenticated buyer profile:', profile);
    console.log('Buyer Endpoint: Authenticated user ID:', profile.id);
    console.log('Buyer Endpoint: Token payload:', await supabase.auth.getUser());

    const body = await request.json();
    const { path, bucket } = signUrlSchema.parse(body);
    console.log('Request body parsed for buyer:', { path, bucket });

    // Verify buyer-specific access
    if (bucket === 'receipts') {
      const pathParts = path.split('/');
      if (pathParts.length >= 2) {
        const escrowId = pathParts[0];
        const { data: escrow, error: escrowError } = await supabase
          .from('escrows')
          .select('seller_id, buyer_id')
          .eq('id', escrowId)
          .single();

        if (!escrow || escrow.buyer_id !== profile.id) {
          console.warn('Access denied for buyer:', { profile, escrow });
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
      }
    }

    // Generate signed URL (15 minutes expiry)
    const { data, error } = await serviceClient.storage
      .from(bucket)
      .createSignedUrl(path, 900); // 15 minutes

    if (error) {
      console.error('Error creating signed URL for buyer:', error);
      return NextResponse.json({ error: 'Failed to create signed URL' }, { status: 500 });
    }

    console.log('Signed URL created for buyer:', data.signedUrl);
    return NextResponse.json({ signedUrl: data.signedUrl });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Validation error for buyer:', error.errors);
      return NextResponse.json({ error: 'Invalid input data' }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'Authentication required') {
      console.warn('Authentication required for buyer:', error);
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    console.error('Buyer sign URL error:', error);
    return NextResponse.json({ error: 'Failed to create signed URL' }, { status: 500 });
  }
}