export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClientWithCookies, createServiceRoleClient } from '@/lib/supabaseServer'
import { shortCode, generateUUID, getFileExtension, isValidImageType } from '@/lib/utils'
import { ESCROW_STATUS } from '@/lib/status'
import { z } from 'zod'

const createEscrowSchema = z.object({
  description: z.string().min(1).max(1000),
  price: z.number().positive().max(1000000)
})

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClientWithCookies()
    const serviceClient = createServiceRoleClient()
    
    // Get authenticated user directly to bypass profile lookup issue
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    
    // Accept either JSON or multipart form data. Some clients may not set
    // Content-Type reliably, so try JSON first and fall back to formData.
    let description: string
    let price: number
    let imageFile: File | null = null
    let assignedAdminId: string | null = null
    // Preuploaded path (from temp upload)
    let preuploadedPath: string | null = null

      // Parse body: try JSON first, then fall back to FormData. Some clients omit Content-Type.
      const contentType = (request.headers.get('content-type') || '').toLowerCase()
      let parsedJson: any = null
      try {
        parsedJson = await request.clone().json()
      } catch (e) {
        parsedJson = null
      }

      if (parsedJson && (parsedJson.description || parsedJson.price)) {
        description = parsedJson.description
        price = Number(parsedJson.price)
        assignedAdminId = parsedJson.assigned_admin_id || parsedJson.assignedAdminId || null
        preuploadedPath = parsedJson.productImagePath || parsedJson.product_image_path || null
      } else {
        // Try FormData as a fallback (covers multipart/form-data and urlencoded). Guard with try/catch to avoid uncaught undici errors.
        try {
          const formData = await request.formData()
          description = formData.get('description') as string
          price = parseFloat(formData.get('price') as string)
          imageFile = formData.get('image') as File | null
          assignedAdminId = (formData.get('assigned_admin_id') as string) || null
          preuploadedPath = (formData.get('productImagePath') as string) || (formData.get('product_image_path') as string) || null
        } catch (fdErr) {
          console.error('Failed to parse request body as JSON or FormData', fdErr, 'content-type=', contentType)
          return NextResponse.json({ error: 'Failed to parse request body', details: contentType }, { status: 400 })
        }
      }
    // Validate input
    const { description: validDescription, price: validPrice } = createEscrowSchema.parse({
      description,
      price
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
      const fileId = generateUUID()
      const extension = getFileExtension(imageFile.name)
      const fileName = `${fileId}.${extension}`
      const filePath = `${user.id}/${fileName}`

      // Upload to storage using service client
      const { error: uploadError } = await serviceClient.storage
        .from('product-images')
        .upload(filePath, imageFile, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        console.error('Error uploading image:', uploadError)
        return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
      }

      productImageUrl = filePath
    }

    // If client supplied a preuploaded path (from temp upload), use that
    if (preuploadedPath) {
      productImageUrl = preuploadedPath
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
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()

    // Ensure seller has bank details set before creating an escrow
    const { data: sellerProfile, error: profileErr } = await (serviceClient as any)
      .from('profiles')
      .select('bank_name, account_number, account_holder_name, profile_completed')
      .eq('id', user.id)
      .single()

    if (profileErr) {
      console.error('Error fetching seller profile:', profileErr)
      return NextResponse.json({ error: 'Failed to verify profile' }, { status: 500 })
    }

    const hasBank = !!(sellerProfile && (sellerProfile.bank_name || sellerProfile.account_number || sellerProfile.account_holder_name || sellerProfile.profile_completed))
    if (!hasBank) {
      return NextResponse.json({ error: 'Please complete your profile bank details before creating an escrow' }, { status: 400 })
    }
    // Create escrow using service client to bypass RLS issues
    const { data: escrow, error: escrowError } = await (serviceClient as any)
      .from('escrows')
      .insert({
        code: code!,
        seller_id: user.id,
        description: validDescription,
        price: validPrice,
        admin_fee: 300,
        product_image_url: productImageUrl,
        assigned_admin_id: assignedAdminId,
        expires_at: expiresAt,
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
        changed_by: user.id
      })

    if (logError) {
      console.error('Error logging status:', logError)
      // Don't fail the request if logging fails
    }

  // Set a short-lived HTTP-only cookie to help redirect seller after login if they sign out
  const response = NextResponse.json({ id: escrow.id, code: escrow.code })
  // cookie expires in 30 minutes
  const expiresDate = new Date(Date.now() + 30 * 60 * 1000)
  response.cookies.set('redirect_escrow', escrow.id, { path: '/', httpOnly: true, sameSite: 'lax', expires: expiresDate })
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
