export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithCookies, createServiceRoleClient } from '@/lib/supabaseServer';
import { requireAuth } from '@/lib/rbac';
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
    console.log('Authenticated seller profile:', profile);
    console.log('Seller Endpoint: Authenticated user ID:', profile.id);
    console.log('Seller Endpoint: Token payload:', await supabase.auth.getUser());

    const body = await request.json();
    const { path, bucket } = signUrlSchema.parse(body);
    console.log('Request body parsed for seller:', { path, bucket });

    // Verify seller-specific access
    if (bucket === 'product-images') {
      const pathParts = path.split('/');
      if (pathParts[0] !== profile.id) {
        console.warn('Access denied: Seller ID mismatch');
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Generate signed URL (15 minutes expiry)
    const { data, error } = await serviceClient.storage
      .from(bucket)
      .createSignedUrl(path, 900); // 15 minutes

    if (error) {
      console.error('Error creating signed URL for seller:', error);
      return NextResponse.json({ error: 'Failed to create signed URL' }, { status: 500 });
    }

    console.log('Signed URL created for seller:', data.signedUrl);
    return NextResponse.json({ signedUrl: data.signedUrl });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Validation error for seller:', error.errors);
      return NextResponse.json({ error: 'Invalid input data' }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'Authentication required') {
      console.warn('Authentication required for seller:', error);
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    console.error('Seller sign URL error:', error);
    return NextResponse.json({ error: 'Failed to create signed URL' }, { status: 500 });
  }
}