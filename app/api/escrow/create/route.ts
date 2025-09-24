export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server.js'
import { createServerClientWithAuthHeader, createServiceRoleClient } from '@/lib/supabaseServer'
import { shortCode, generateUUID, getFileExtension, isValidImageType } from '@/lib/utils'
import { ESCROW_STATUS } from '@/lib/status'
import { z } from 'zod'


/**
 * POST /api/escrow/create
 *
 * Creates a new escrow transaction as a seller.
 * Handles both cookie-based and one-time token authentication.
 * Steps:
 *   1. Authenticates the user (cookie or one-time token)
 *   2. Validates input (description, price)
 *   3. Generates a unique code and UUID
 *   4. Inserts the escrow into the database
 *   5. Returns the escrow code and ID
 *
 * Request body:
 *   { description: string, price: number, __one_time_token?: string }
 *
 * Returns:
 *   200: { ok: true, code, escrowId }
 *   400: { error: string } (validation)
 *   401: { error: string } (authentication)
 *   500: { error: string } (insert or server error)
 */
const createEscrowSchema = z.object({
  description: z.string().min(1).max(1000),
  price: z.number().positive().max(1000000)
})

export async function POST(request: NextRequest) {
  try {
    let parsedBody: any;
    try {
      const formData = await request.formData();
      parsedBody = {
        description: formData.get('description')?.toString() || '',
        price: parseFloat(formData.get('price')?.toString() || '0'),
        assigned_admin_id: formData.get('assigned_admin_id')?.toString(),
        productImagePath: formData.get('productImagePath')?.toString(),
        image: formData.get('image') as File | null,
      };
      console.log('Parsed FormData body:', parsedBody);
    } catch (error) {
      console.error('Failed to parse FormData body:', error);
      return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
    }

    const supabase = createServerClientWithAuthHeader(request);
    const serviceClient = createServiceRoleClient();

    // Log authentication attempt
    console.log('Attempting to authenticate user...');
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    console.log('Authentication result:', { user, userError });

    let authenticatedUser = user;

    if (!authenticatedUser) {
      console.log('No user in session, checking one-time token...');
      let token = parsedBody?.__one_time_token || request.headers.get('x-one-time-token') || null;
      if (!token) {
        const authHeader = request.headers.get('authorization') || '';
        if (authHeader.toLowerCase().startsWith('bearer ')) {
          token = authHeader.slice(7).trim();
        }
      }

      console.log('Authentication token:', token);
      console.log('Request headers:', Object.fromEntries(request.headers));

      if (token) {
        try {
          const { verifyAndConsumeSignedToken } = await import('@/lib/signedAuth');
          console.log('Verifying one-time token...');
          const userId = await verifyAndConsumeSignedToken(token);
          console.log('Token verification result:', userId);
          if (userId) {
            const { data: userData, error: userFetchError } = await serviceClient
              .from('profiles')
              .select('id, email, full_name')
              .eq('id', userId)
              .single();

            console.log('Profile fetch result:', { userData, userFetchError });
            // Adjust authenticatedUser assignment to match the expected User type
            authenticatedUser = {
              id: userId,
              email: userData?.email || 'test@example.com',
              app_metadata: {},
              user_metadata: {},
              aud: 'authenticated',
              created_at: new Date().toISOString(),
            };
          }
        } catch (e) {
          console.warn('One-time token verification failed:', e);
        }
      }
    }

    if (!authenticatedUser) {
      console.error('Authentication failed:', { userError, authenticatedUser });
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    console.log('Authenticated user:', authenticatedUser);

    // Validate input
    const { description: validDescription, price: validPrice } = createEscrowSchema.parse({
      description: parsedBody.description,
      price: parsedBody.price,
    });

    console.log('Validated input:', { validDescription, validPrice });

    // Ensure profile exists
    console.log('Ensuring profile exists for seller_id:', authenticatedUser.id);
    const { data: existingProfile } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('id', authenticatedUser.id)
      .single();

    if (!existingProfile) {
      console.log('Profile not found, creating...');
      const { error: profileError } = await serviceClient
        .from('profiles')
        .insert({
          id: authenticatedUser.id,
          email: authenticatedUser.email || 'unknown@example.com',
          full_name: authenticatedUser.user_metadata?.full_name || '',
          role: 'seller',
        });
      if (profileError) {
        console.error('Failed to create profile:', profileError);
        return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
      }
    }

    // Check if seller already has an active escrow
    console.log('Checking for active escrows...');
    const { data: activeEscrows, error: activeError } = await serviceClient
      .from('escrows')
      .select('id, code, description, price, status, created_at')
      .eq('seller_id', authenticatedUser.id)
      .not('status', 'in', `(${ESCROW_STATUS.COMPLETED},${ESCROW_STATUS.REFUNDED},${ESCROW_STATUS.CLOSED})`);

    if (activeError) {
      console.error('Error checking active escrows:', activeError);
      return NextResponse.json({ error: 'Failed to check active escrows' }, { status: 500 });
    }

    if (activeEscrows && activeEscrows.length > 0) {
      console.log('Seller has active escrow:', activeEscrows[0]);
      return NextResponse.json({
        error: 'You already have an ongoing transaction. Please complete or cancel it before creating a new one.',
        activeEscrow: activeEscrows[0]
      }, { status: 409 });
    }

    // Prepare insert data
    const insertData: any = {
      code: shortCode(),
      seller_id: authenticatedUser.id,
      description: validDescription,
      price: validPrice,
      admin_fee: 300,
      status: ESCROW_STATUS.WAITING_PAYMENT,
    };
    if (parsedBody.assigned_admin_id) {
      insertData.assigned_admin_id = parsedBody.assigned_admin_id;
    }
    console.log('Insert data:', insertData);

    // Insert escrow into database
    console.log('Inserting escrow into database...');
    const { data: escrow, error: escrowError } = await serviceClient
      .from('escrows')
      .insert(insertData)
      .select()
      .single();

    console.log('Database insertion result:', { escrow, escrowError });

    if (escrowError) {
      console.error('Error creating escrow:', escrowError);
      return NextResponse.json({ error: 'Failed to create escrow', details: escrowError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, escrow });
  } catch (error) {
    console.error('Unhandled error in POST /api/escrow/create:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
