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
  const makeJson = (payload: any, authenticatedUser?: any, debugEscrowId?: string | null, status?: number) => {
    try {
      if (process.env.DEBUG) {
        payload._debug = payload._debug || {}
        try { payload._debug.cookie = request.headers.get('cookie') || null } catch (e) {}
        try { payload._debug.serverUser = (authenticatedUser) ? (authenticatedUser.id || null) : null } catch (e) {}
        try { payload._debug.escrowId = debugEscrowId || null } catch (e) {}
        payload._debug.ts = Date.now()
      }
    } catch (e) {}
    return typeof status === 'number' ? NextResponse.json(payload, { status }) : NextResponse.json(payload)
  }

  // Track the escrowId value used for lookups so it can be returned in _debug
  let debugEscrowId: string | null = null

  // Ensure route is only used for POST requests
  if (request.method !== 'POST') {
    return makeJson({ error: 'Method Not Allowed' }, null, null, 405)
  }
  let uploadedFilePath: string | null = null
  try {
  const supabase = createServerClientWithAuthHeader(request)
    const serviceClient = createServiceRoleClient()
    
    // Read form data once at the beginning
    const formData = await request.formData()
    const escrowIdFromForm = formData.get('escrowId') as string
    let receiptFile = formData.get('file') as File
    
    // Use simple authentication instead of requireAuth
  const { data: { user }, error: authError } = await supabase.auth.getUser()
    let authenticatedUser = user
    if (process.env.DEBUG) {
    }

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
          // Attempt one-time token verification (no verbose logs)
          const userId = await verifyAndConsumeSignedToken(token)
          if (userId) {
            authenticatedUser = { id: userId } as any
          } else {
            console.warn('Upload receipt: one-time token present but not valid/expired')
            return makeJson({ error: 'Invalid or expired one-time token' }, null, null, 401)
          }
        } catch (e) {
          console.warn('Error importing/verifying one-time token')
        }
      }
    }

    if (!authenticatedUser) {
      return makeJson({ error: 'Authentication required' }, null, null, 401)
    }
    

  const escrowId = escrowIdFromForm
  debugEscrowId = escrowId

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
      return makeJson({ error: parseResult.error.errors[0].message }, authenticatedUser, debugEscrowId, 400)
    }

    // Get escrow using service client. Accept either the UUID id or the human-friendly code.
    let escrow = null
    let escrowError: any = null
    try {
      const byId = await (serviceClient as any)
        .from('escrows')
        .select('*')
        .eq('id', escrowId)
        .single()
      escrow = byId.data
      escrowError = byId.error
    } catch (e) {
      // ignore
    }

    if (!escrow) {
      try {
        const byCode = await (serviceClient as any)
          .from('escrows')
          .select('*')
          .eq('code', escrowId)
          .single()
        escrow = byCode.data
        escrowError = byCode.error
      } catch (e) {
        // ignore
      }
    }

    if (escrowError || !escrow) {
      return makeJson({ error: 'Transaction not found' }, authenticatedUser, debugEscrowId, 404)
    }

    // Check if user is the buyer
    if (escrow.buyer_id !== authenticatedUser.id) {
      return makeJson({ error: 'Only the buyer can upload receipts' }, authenticatedUser, debugEscrowId, 403)
    }

    // Validate file
    if (!isValidReceiptType(receiptFile.type)) {
      return makeJson({ 
        error: 'Invalid file type. Only JPEG, PNG, WebP, and PDF are allowed.' 
      }, authenticatedUser, debugEscrowId, 400)
    }

    if (receiptFile.size > 10 * 1024 * 1024) { // 10MB limit
      return makeJson({ error: 'File too large. Maximum size is 10MB.' }, authenticatedUser, debugEscrowId, 400)
    }


    // Generate unique filename
    const fileId = generateUUID()
    const extension = getFileExtension(receiptFile.name)
    const fileName = `${fileId}.${extension}`
    const filePath = `${escrow.id}/${authenticatedUser.id}/${fileName}`
    uploadedFilePath = filePath

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
      return makeJson({ 
        error: 'Failed to upload receipt', 
        details: uploadError.message 
      }, authenticatedUser, debugEscrowId, 500)
    }

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
      return makeJson({ error: 'Failed to save receipt' }, authenticatedUser, debugEscrowId, 500)
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
        return makeJson({ error: 'Failed to update escrow status' }, authenticatedUser, debugEscrowId, 500)
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

  return makeJson({ ok: true }, authenticatedUser, debugEscrowId)

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
    return makeJson({ error: 'Failed to upload receipt' }, null, null, 500)
  }
}
