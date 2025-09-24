export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClientWithAuthHeader, createServiceRoleClient } from '@/lib/supabaseServer'
import { z } from 'zod'
import { ESCROW_STATUS, canTransition, EscrowStatus } from '@/lib/status'

/**
 * POST /api/escrow/finalize-receipt
 *
 * Finalizes a temporary receipt upload by moving it to permanent storage
 * and updating the escrow status.
 *
 * Request: JSON with fields:
 *   - escrowId: string
 *   - tempPath: string (path in temp storage)
 *
 * Returns:
 *   200: { receiptUrl: string }
 *   400: { error: string } (validation error)
 *   401: { error: string } (authentication)
 *   403: { error: string } (not buyer)
 *   404: { error: string } (escrow not found)
 *   500: { error: string } (server error)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClientWithAuthHeader(request)
    const serviceClient = createServiceRoleClient()

    // Parse request body first to get tempPath for token extraction
    const body = await request.json()
    const schema = z.object({
      escrowId: z.string().min(1, 'Escrow ID is required'),
      tempPath: z.string().min(1, 'Temp path is required')
    })

    const parseResult = schema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.errors[0].message }, { status: 400 })
    }

    const { escrowId, tempPath } = parseResult.data

    // Check for one-time token in headers
    let token = request.headers.get('x-one-time-token') || request.headers.get('authorization')?.replace('Bearer ', '')
    let authenticatedUser = null

    if (token) {
      try {
        const { verifyAndConsumeSignedToken } = await import('@/lib/signedAuth')
        console.debug('Finalize receipt: one-time token present')
        const userId = await verifyAndConsumeSignedToken(token)
        console.debug('Finalize receipt: verifyAndConsumeSignedToken result ok=', !!userId)
        if (userId) {
          authenticatedUser = { id: userId }
        } else {
          console.warn('Finalize receipt: one-time token present but not valid/expired')
        }
      } catch (e) {
        console.warn('Error verifying one-time token')
      }
    }

    // Fallback to session authentication
    if (!authenticatedUser) {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
      }
      authenticatedUser = user
    }

    // Get escrow
    const { data: escrow, error: escrowError } = await serviceClient
      .from('escrows')
      .select('*')
      .eq('id', escrowId)
      .single()

    if (escrowError || !escrow) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Check if user is the buyer
    if (escrow.buyer_id !== authenticatedUser.id) {
      return NextResponse.json({ error: 'Only the buyer can finalize receipts' }, { status: 403 })
    }

    // Download file from temp storage (product-images bucket with temp/ prefix)
    const { data: tempFile, error: downloadError } = await serviceClient.storage
      .from('product-images')
      .download(tempPath)

    if (downloadError || !tempFile) {
      console.error('Error downloading temp file:', downloadError)
      return NextResponse.json({ error: 'Failed to access temporary file' }, { status: 500 })
    }

    // Generate permanent path
    const fileName = tempPath.split('/').pop() || 'receipt.jpg'
    const permanentPath = `${escrow.id}/${authenticatedUser.id}/${fileName}`

    // Upload to permanent receipts storage
    const { error: uploadError } = await serviceClient.storage
      .from('receipts')
      .upload(permanentPath, tempFile, {
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      console.error('Error uploading to permanent storage:', uploadError)
      return NextResponse.json({ error: 'Failed to finalize receipt' }, { status: 500 })
    }

    // Clean up temp file
    await serviceClient.storage.from('product-images').remove([tempPath])

    // Insert receipt record
    const { error: receiptError } = await serviceClient
      .from('receipts')
      .insert({
        escrow_id: escrow.id,
        uploaded_by: authenticatedUser.id,
        file_path: permanentPath
      })

    if (receiptError) {
      console.error('Error creating receipt record:', receiptError)
      // Clean up uploaded file
      await serviceClient.storage.from('receipts').remove([permanentPath])
      return NextResponse.json({ error: 'Failed to save receipt' }, { status: 500 })
    }

    // Update escrow status to waiting_admin if transitioning from waiting_payment
    if (escrow.status === ESCROW_STATUS.WAITING_PAYMENT &&
        canTransition(escrow.status as EscrowStatus, ESCROW_STATUS.WAITING_ADMIN)) {

      await serviceClient
        .from('escrows')
        .update({ status: ESCROW_STATUS.WAITING_ADMIN })
        .eq('id', escrow.id)

      // Log status change
      await serviceClient
        .from('status_logs')
        .insert({
          escrow_id: escrow.id,
          status: ESCROW_STATUS.WAITING_ADMIN,
          changed_by: authenticatedUser.id
        })
    }

    // Generate public URL for the receipt
    const { data: urlData } = serviceClient.storage
      .from('receipts')
      .getPublicUrl(permanentPath)

    return NextResponse.json({
      receiptUrl: urlData.publicUrl
    })

  } catch (error) {
    console.error('Finalize receipt error:', error)
    return NextResponse.json({ error: 'Failed to finalize receipt' }, { status: 500 })
  }
}