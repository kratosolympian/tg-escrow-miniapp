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

// Helper to return JSON and optionally append _debug info when DEBUG is enabled
function makeJson(payload: any, request?: NextRequest, serverUser?: any, status?: number) {
  try {
    if (process.env.DEBUG) {
      payload._debug = payload._debug || {}
      try {
        payload._debug.cookie = request ? request.headers.get('cookie') || null : null
      } catch (e) {}
      try {
        payload._debug.serverUser = serverUser ? (serverUser.id || serverUser) : null
      } catch (e) {}
      try {
        // Surface any debug escrow id resolved earlier in the request lifecycle
        // (some handlers may attach request.__debugEscrowId)
        // @ts-ignore
        const debugEscrowId = request && (request as any).__debugEscrowId
        if (debugEscrowId) payload._debug.escrowId = debugEscrowId
      } catch (e) {}
      payload._debug.ts = Date.now()
    }
  } catch (e) {}
  return typeof status === 'number' ? NextResponse.json(payload, { status }) : NextResponse.json(payload)
}

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
      return makeJson({ error: 'Invalid path format' }, request, profile, 400);
    }

    // Accept either an escrow UUID or the escrow code in the path. Try id lookup
    // first (fast/common), then fall back to lookup by code for paths that were
    // previously using the escrow code as the prefix.
    const escrowIdOrCode = pathParts[0];
    let escrow: any = null;

    // Try lookup by id first
    try {
      const { data } = await serviceClient
        .from('escrows')
        .select('id, buyer_id')
        .eq('id', escrowIdOrCode)
        .maybeSingle();
      if (data) escrow = data;
    } catch (e) {}

    // If not found by id, try lookup by code
    if (!escrow) {
      try {
        const { data } = await serviceClient
          .from('escrows')
          .select('id, buyer_id')
          .eq('code', escrowIdOrCode)
          .maybeSingle();
        if (data) escrow = data;
      } catch (e) {}
    }

    // Attach the resolved escrow id into debug payload when present
    if (process.env.DEBUG && escrow && escrow.id) {
      try {
        // @ts-ignore
        request['__debugEscrowId'] = escrow.id
      } catch (e) {}
    }

    if (!escrow || escrow.buyer_id !== profile.id) {
      return makeJson({ error: 'Access denied' }, request, profile, 403);
    }
  } else if (bucket === 'product-images') {
    // Buyers can access product images for escrows they are part of
    const pathParts = path.split('/');
    if (pathParts.length < 2) {
      return makeJson({ error: 'Invalid path format' }, request, profile, 400);
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
      return makeJson({ error: 'Access denied' }, request, profile, 403);
    }
  } else {
    return makeJson({ error: 'Access denied' }, request, profile, 403);
  }

  const signedUrl = await generateSignedUrl(serviceClient, bucket, path);
  return makeJson({ signedUrl }, request, profile);
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
    return makeJson({ error: 'Access denied' }, request, profile, 403);
  }

  const pathParts = path.split('/');
  if (pathParts.length < 2 || pathParts[0] !== profile.id) {
    return makeJson({ error: 'Access denied' }, request, profile, 403);
  }

  const signedUrl = await generateSignedUrl(serviceClient, bucket, path);
  return makeJson({ signedUrl }, request, profile);
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
      return makeJson({ error: 'Role not supported' }, request, profile, 403);
    }
  } catch (error) {
    // Handle common expected errors more gracefully
    if (error instanceof z.ZodError) {
      return makeJson({ error: 'Invalid input data' }, request, null, 400)
    }
    // Authentication failures are expected for anonymous requests; return 401 instead of 500
    if (error instanceof Error && error.message === 'Authentication required') {
      return makeJson({ error: 'Authentication required' }, request, null, 401)
    }

    console.error('Sign URL error:', error)
    return makeJson({ error: 'Failed to create signed URL' }, request, null, 500)
  }
}
