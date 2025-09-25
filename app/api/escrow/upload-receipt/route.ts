export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClientWithAuthHeader, createServiceRoleClient } from '@/lib/supabaseServer'
import { requireAuth } from '@/lib/rbac'
import { generateUUID, getFileExtension, isValidReceiptType } from '@/lib/utils'
import { z } from 'zod'
import { ESCROW_STATUS, canTransition, EscrowStatus } from '@/lib/status'

/**
 * POST /api/escrow/upload-receipt
 *
 * Handles secure upload of a payment receipt file for an escrow transaction.
 * Steps:
 *   1. Authenticates the user (must be the buyer for the escrow)
 *   2. Validates input (escrowId, file)
 *   3. Validates file type and size
 *   4. Uploads the file to Supabase Storage (atomic, cleans up on error)
 *   5. Inserts a record into the receipts table
 *   6. Optionally updates escrow status and logs status change
 *   7. Cleans up on error
 *
 * Request: multipart/form-data with fields:
 *   - escrowId: string
 *   - file: File
 *
 * Returns:
 *   200: { ok: true }
 *   400: { error: string } (validation or file error)
 *   401: { error: string } (authentication)
 *   403: { error: string } (not buyer)
 *   404: { error: string } (escrow not found)
 *   500: { error: string } (upload or DB error)
 */
export async function POST(request: NextRequest) {
  // Ensure route is only used for POST requests
  if (request.method !== 'POST') {
    if (process.env.DEBUG) console.log('405 - Method Not Allowed:', request.method, request.url)
    return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 })
  }
  let uploadedFilePath: string | null = null
  try {
  // Minimal audit log
  if (process.env.DEBUG) console.log('Receipt upload API called')
    
  const supabase = createServerClientWithAuthHeader(request)
    const serviceClient = createServiceRoleClient()
    
    // Read form data once at the beginning
    const formData = await request.formData()
    const escrowIdFromForm = formData.get('escrowId') as string
    let receiptFile = formData.get('file') as File
    
    // Use simple authentication instead of requireAuth
  const { data: { user }, error: authError } = await supabase.auth.getUser()
    let authenticatedUser = user

    // If no user in session, allow one-time token authentication
    if (!authenticatedUser) {
      let token = formData.get('__one_time_token') as string
      if (!token) {
        const headerToken = request.headers.get('x-one-time-token') || null
        if (headerToken) token = headerToken
      }
      if (!token) {
        const authHeader = request.headers.get('authorization') || ''
        if (authHeader.toLowerCase().startsWith('bearer ')) {
          token = authHeader.slice(7).trim()
        }
      }

      if (token) {
        try {
          const { verifyAndConsumeSignedToken } = await import('@/lib/signedAuth')
          console.debug('Upload receipt: one-time token present')
          const userId = await verifyAndConsumeSignedToken(token)
          console.debug('Upload receipt: verifyAndConsumeSignedToken result ok=', !!userId)
          if (userId) {
            authenticatedUser = { id: userId } as any
          } else {
            console.warn('Upload receipt: one-time token present but not valid/expired')
            return NextResponse.json({ error: 'Invalid or expired one-time token' }, { status: 401 })
          }
        } catch (e) {
          console.warn('Error importing/verifying one-time token')
        }
      }
    }

    if (!authenticatedUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    

    const escrowId = escrowIdFromForm

    // For testing: allow empty file
    if (!receiptFile && process.env.NODE_ENV === 'development') {
      // Create a dummy file for testing
      const dummyContent = 'test receipt content'
      const blob = new Blob([dummyContent], { type: 'text/plain' })
      receiptFile = new File([blob], 'test-receipt.txt', { type: 'text/plain' })
    }

    // Zod schema for input validation
    const schema = z.object({
      escrowId: z.string().min(1, 'Escrow ID is required'),
      file: z.instanceof(File, { message: 'File is required' })
    })
    const parseResult = schema.safeParse({ escrowId, file: receiptFile })
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.errors[0].message }, { status: 400 })
    }

    // Get escrow using service client
    const { data: escrow, error: escrowError } = await (serviceClient as any)
      .from('escrows')
      .select('*')
      .eq('id', escrowId)
      .single()

    if (escrowError || !escrow) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Check if user is the buyer
    if (escrow.buyer_id !== authenticatedUser.id) {
      return NextResponse.json({ error: 'Only the buyer can upload receipts' }, { status: 403 })
    }

    // Validate file
    if (!isValidReceiptType(receiptFile.type)) {
      return NextResponse.json({ 
        error: 'Invalid file type. Only JPEG, PNG, WebP, and PDF are allowed.' 
      }, { status: 400 })
    }

    if (receiptFile.size > 10 * 1024 * 1024) { // 10MB limit
      return NextResponse.json({ error: 'File too large. Maximum size is 10MB.' }, { status: 400 })
    }


    // Generate unique filename
    const fileId = generateUUID()
    const extension = getFileExtension(receiptFile.name)
    const fileName = `${fileId}.${extension}`
    const filePath = `${escrow.id}/${authenticatedUser.id}/${fileName}`
    uploadedFilePath = filePath

    if (process.env.DEBUG) console.log('Starting file upload for escrow:', escrow.id)

    // Upload to storage using service client
    const { error: uploadError } = await serviceClient.storage
      .from('receipts')
      .upload(filePath, receiptFile, {
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      // Clean up any partial file
      await serviceClient.storage.from('receipts').remove([filePath])
      console.error('Error uploading receipt:', uploadError)
      return NextResponse.json({ 
        error: 'Failed to upload receipt', 
        details: uploadError.message 
      }, { status: 500 })
    }

    if (process.env.DEBUG) console.log('File uploaded successfully')

    // Insert receipt record
    const { error: receiptError } = await (serviceClient as any)
      .from('receipts')
      .insert({
        escrow_id: escrow.id,
        uploaded_by: authenticatedUser.id,
        file_path: filePath
      })

    if (receiptError) {
      console.error('Error creating receipt record')
      // Clean up uploaded file
      await serviceClient.storage.from('receipts').remove([filePath])
      return NextResponse.json({ error: 'Failed to save receipt' }, { status: 500 })
    }

    // Update escrow status to waiting_admin if transitioning from waiting_payment
    if (escrow.status === ESCROW_STATUS.WAITING_PAYMENT && 
        canTransition(escrow.status as EscrowStatus, ESCROW_STATUS.WAITING_ADMIN)) {
      
      const { error: statusError } = await (serviceClient as any)
        .from('escrows')
        .update({ status: ESCROW_STATUS.WAITING_ADMIN })
        .eq('id', escrow.id)

      if (statusError) {
        console.error('Error updating escrow status:', statusError)
        // Clean up uploaded file
        await serviceClient.storage.from('receipts').remove([filePath])
        return NextResponse.json({ error: 'Failed to update escrow status' }, { status: 500 })
      }

      // Log status change
      const { error: logError } = await (serviceClient as any)
        .from('status_logs')
        .insert({
          escrow_id: escrow.id,
          status: ESCROW_STATUS.WAITING_ADMIN,
          changed_by: authenticatedUser.id
        })

      if (logError) {
        console.error('Error logging status change:', logError)
        // Don't fail the whole operation for logging errors, but log it
      }
    }

    return NextResponse.json({ ok: true })

  } catch (error) {
    // Clean up uploaded file if it exists
    if (uploadedFilePath) {
      try {
        await createServiceRoleClient().storage.from('receipts').remove([uploadedFilePath])
      } catch (cleanupErr) {
        if (process.env.DEBUG) console.error('Cleanup error after failed receipt upload:', cleanupErr)
      }
    }
    console.error('Upload receipt error:', error)
    return NextResponse.json({ error: 'Failed to upload receipt' }, { status: 500 })
  }
}
