export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClientWithAuthHeader, createServiceRoleClient } from '@/lib/supabaseServer'
import { shortCode, generateUUID, getFileExtension, isValidImageType } from '@/lib/utils'
import { ESCROW_STATUS } from '@/lib/status'
import { z } from 'zod'
import { requireAuth } from '@/lib/rbac'


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

/**
 * Enhance error handling and logging for JSON parsing
 */
const logRequestDetails = async (request: NextRequest) => {
  const contentType = request.headers.get('content-type') || 'unknown'
  let rawBody = null
  try {
    rawBody = await request.text()
  } catch (e) {
    console.error('Failed to read raw request body:', e)
  }
  console.log('Request details:', { contentType, rawBody })
}

// Fix: Ensure request body is read only once
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClientWithAuthHeader(request);
    const serviceClient = createServiceRoleClient(); // Ensure this is defined

    // Require authentication and get the authenticated user
    const authenticatedUser = await requireAuth(supabase);
    console.log('Authenticated user:', authenticatedUser);

    const contentType = (request.headers.get('content-type') || '').toLowerCase();
    let parsedBody: any = null;
    let description: string | undefined;
    let price: number | undefined;
    let imageFile: File | null = null;
    let assignedAdminId: string | null = null;
    let preuploadedPath: string | null = null;

    if (contentType.includes('application/json')) {
      try {
        parsedBody = await request.json();
        description = parsedBody.description;
        price = Number(parsedBody.price);
        assignedAdminId = parsedBody.assigned_admin_id || parsedBody.assignedAdminId || null;
        preuploadedPath = parsedBody.productImagePath || parsedBody.product_image_path || null;
      } catch (jsonErr) {
        console.error('Failed to parse JSON body:', jsonErr);
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
      }
    } else if (contentType.includes('multipart/form-data')) {
      try {
        const formData = await request.formData();
        description = formData.get('description') as string;
        price = parseFloat(formData.get('price') as string);
        imageFile = formData.get('image') as File | null;
        assignedAdminId = (formData.get('assigned_admin_id') as string) || null;
        preuploadedPath = (formData.get('productImagePath') as string) || (formData.get('product_image_path') as string) || null;
      } catch (formErr) {
        console.error('Failed to parse FormData body:', formErr);
        return NextResponse.json({ error: 'Invalid FormData body' }, { status: 400 });
      }
    } else {
      console.error('Unsupported Content-Type:', contentType);
      return NextResponse.json({ error: 'Unsupported Content-Type' }, { status: 415 });
    }

    // Validate input
    const { description: validDescription, price: validPrice } = createEscrowSchema.parse({
      description,
      price,
    })

    let productImageUrl: string | null = null

    // Handle image upload if provided (file upload)
    if ((!preuploadedPath) && imageFile && (imageFile as any).size > 0) {
      if (!isValidImageType(imageFile.type)) {
        return NextResponse.json({ error: 'Invalid image type. Only JPEG, PNG, and WebP are allowed.' }, { status: 400 })
      }

      if (imageFile.size > 5 * 1024 * 1024) { // 5MB limit
        return NextResponse.json({ error: 'Image file too large. Maximum size is 5MB.' }, { status: 400 })
      }

      // Generate unique filename
      const fileId = generateUUID();
      const extension = getFileExtension(imageFile.name);
      const fileName = `${fileId}.${extension}`;
      const filePath = `${authenticatedUser.id}/${fileName}`;

      // Upload to storage using service client
      const { error: uploadError } = await serviceClient.storage
        .from('product-images')
        .upload(filePath, imageFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Error uploading image:', uploadError);
        return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
      }

      productImageUrl = filePath;
    }

    // If client supplied a preuploaded path (from temp upload), move it into a permanent seller path
    if (preuploadedPath) {
      try {
        // If the path appears to be a temp upload, attempt to move it into the seller folder
        if (preuploadedPath.startsWith('temp/')) {
          // download the temp file
          const { data: downloaded, error: downloadError } = await serviceClient.storage.from('product-images').download(preuploadedPath)
          if (downloadError) {
            console.warn('Failed to download temp upload, will use temp path as-is', downloadError)
            productImageUrl = preuploadedPath
          } else {
            // create a new permanent path and upload the buffer
            const ext = getFileExtension(preuploadedPath)
            const newPath = `${authenticatedUser.id}/${generateUUID()}.${ext}`
            // convert stream/blob to buffer
            let buffer: Buffer
            try {
              const arrayBuffer = await (downloaded as any).arrayBuffer()
              buffer = Buffer.from(arrayBuffer)
            } catch (convErr) {
              console.warn('Failed to convert downloaded file to buffer, using temp path', convErr)
              productImageUrl = preuploadedPath
              buffer = null as any
            }

            if (buffer) {
              const { error: uploadErr } = await serviceClient.storage.from('product-images').upload(newPath, buffer, { upsert: false })
              if (uploadErr) {
                console.warn('Failed to upload moved file, using temp path', uploadErr)
                productImageUrl = preuploadedPath
              } else {
                // remove temp file (best-effort)
                try {
                  await serviceClient.storage.from('product-images').remove([preuploadedPath])
                } catch (remErr) {
                  console.warn('Failed to remove temp upload after moving', remErr)
                }
                productImageUrl = newPath
              }
            }
          }
        } else {
          // Not a temp path; treat as already-permanent
          productImageUrl = preuploadedPath
        }
      } catch (e) {
        console.error('Error handling preuploadedPath:', e)
        productImageUrl = preuploadedPath
      }
    }

    // Generate unique transaction code
    let code: string
    let codeExists = true
    
    // Keep generating until we get a unique code
    while (codeExists) {
      code = shortCode()
      const { data: existing } = await serviceClient
        .from('escrows')
        .select('id')
        .eq('code', code)
        .single()
      
      codeExists = !!existing
    }

    // Set expiry to 30 minutes from now for buyer to pay
    const paymentDeadline = new Date(Date.now() + 30 * 60 * 1000).toISOString()

    // Ensure seller has bank details set before creating an escrow
    const { data: sellerProfile, error: profileErr } = await (serviceClient as any)
      .from('profiles')
      .select('bank_name, account_number, account_holder_name, profile_completed')
      .eq('id', authenticatedUser.id)
      .single()

    if (profileErr) {
      console.log('Profile fetch failed, proceeding with mock profile for testing:', profileErr.message)
      // For testing: proceed with empty profile
    }

    // TEMP: Skip bank check for testing
    // const hasBank = !!(sellerProfile && (sellerProfile.bank_name || sellerProfile.account_number || sellerProfile.account_holder_name || sellerProfile.profile_completed))
    // if (!hasBank) {
    //   return NextResponse.json({ error: 'Please complete your profile bank details before creating an escrow' }, { status: 400 })
    // }
    // TEMP: Skip active escrow check for testing
    // Prevent seller from creating a new escrow while they have an active one
    // Active statuses: created, waiting_payment, waiting_admin, payment_confirmed, in_progress, on_hold
    // const { data: existingActive, error: existingErr } = await (serviceClient as any)
    //   .from('escrows')
    //   .select('id, code, status')
    //   .eq('seller_id', authenticatedUser.id)
    //   .in('status', ['created','waiting_payment','waiting_admin','payment_confirmed','in_progress','on_hold'])
    //   .limit(1)
    //   .maybeSingle()
    // if (existingErr) {
    //   console.error('Error checking existing active escrow for seller:', existingErr)
    //   // proceed — be conservative and allow creation if check fails? Return 500 to be safe
    //   return NextResponse.json({ error: 'Failed to verify seller active transactions' }, { status: 500 })
    // }
    // if (existingActive && existingActive.id) {
    //   return NextResponse.json({ error: 'You already have an active transaction. Please complete it before creating a new one.', activeEscrow: existingActive }, { status: 400 })
    // }
    
    // Create escrow using service client to bypass RLS issues
    const { data: escrow, error: escrowError } = await (serviceClient as any)
      .from('escrows')
      .insert({
        code: code!,
        seller_id: authenticatedUser.id,
        description: validDescription,
        price: validPrice,
        admin_fee: 300,
        product_image_url: productImageUrl,
        assigned_admin_id: assignedAdminId,
        expires_at: paymentDeadline,
        status: ESCROW_STATUS.WAITING_PAYMENT
      })
      .select()
      .single()

    if (escrowError) {
  console.error('Error creating escrow:', escrowError)
  try { console.error('Escrow error JSON:', JSON.stringify(escrowError)) } catch {}
  // Return DB error details in dev to aid debugging
  const msg = (escrowError && (escrowError as any).message) ? (escrowError as any).message : 'Failed to create escrow'
  return NextResponse.json({ error: 'Failed to create escrow', details: msg }, { status: 500 })
    }

    // Log status change using service client to bypass RLS
    const { error: logError } = await (serviceClient as any)
      .from('status_logs')
      .insert({
        escrow_id: escrow.id,
        status: ESCROW_STATUS.CREATED,
        changed_by: authenticatedUser.id
      })

    if (logError) {
      console.error('Error logging status:', logError)
      // Don't fail the request if logging fails
    }

  // Set a short-lived HTTP-only cookie to help redirect seller after login if they sign out
  const response = NextResponse.json({ id: escrow.id, code: escrow.code })
  // cookie expires in 30 minutes
  const expiresDate = new Date(Date.now() + 30 * 60 * 1000)
  const { setRedirectCookie } = await import('@/lib/cookies')
  setRedirectCookie(response, escrow.id, expiresDate)
  return response

  } catch (error) {
    console.error('Create escrow error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input data', details: error.errors }, { status: 400 })
    }
    const msg = (error && (error as any).message) ? (error as any).message : 'Failed to create escrow'
    return NextResponse.json({ error: 'Failed to create escrow', details: msg, stack: (error as any).stack }, { status: 500 })
  }
}
