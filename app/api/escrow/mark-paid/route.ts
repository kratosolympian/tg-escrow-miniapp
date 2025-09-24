export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClientWithCookies, createServiceRoleClient } from '@/lib/supabaseServer'
import { ESCROW_STATUS, canTransition, EscrowStatus } from '@/lib/status'
import { z } from 'zod'

/**
 * POST /api/escrow/mark-paid
 *
 * Allows the buyer to mark an escrow as paid after uploading a receipt.
 * This is typically called after receipt upload, but validates the escrow state.
 *
 * Request body:
 *   { escrow_id: string }
 *
 * Returns:
 *   200: { ok: true }
 *   400: { error: string } (validation)
 *   403: { error: string } (not buyer)
 *   404: { error: string } (not found)
 *   409: { error: string } (invalid status transition)
 *   500: { error: string } (server error)
 */
const markPaidSchema = z.object({
  escrow_id: z.string().uuid()
})

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClientWithCookies()
    const serviceClient = createServiceRoleClient()

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.log('Mark-paid: Authentication failed')
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Parse and validate request body
    const body = await request.json()
    console.log('Mark-paid: Received request body:', body)
    const parseResult = markPaidSchema.safeParse(body)
    if (!parseResult.success) {
      console.log('Mark-paid: Validation failed:', parseResult.error.errors)
      return NextResponse.json({ error: parseResult.error.errors[0].message }, { status: 400 })
    }

    const { escrow_id } = parseResult.data
    console.log('Mark-paid: Processing escrow_id:', escrow_id, 'for user:', user.id)

    // Get escrow
    const { data: escrow, error: escrowError } = await serviceClient
      .from('escrows')
      .select('*')
      .eq('id', escrow_id)
      .single()

    if (escrowError || !escrow) {
      return NextResponse.json({ error: 'Escrow not found' }, { status: 404 })
    }

    // Check if user is the buyer
    if (escrow.buyer_id !== user.id) {
      console.log('Mark-paid: User', user.id, 'is not buyer of escrow', escrow_id, 'buyer_id:', escrow.buyer_id)
      return NextResponse.json({ error: 'Only the buyer can mark as paid' }, { status: 403 })
    }

    console.log('Mark-paid: User', user.id, 'is marking escrow', escrow_id, 'as paid. Current status:', escrow.status)

    // Check if escrow is in waiting_payment or already waiting_admin status
    if (escrow.status !== ESCROW_STATUS.WAITING_PAYMENT && escrow.status !== ESCROW_STATUS.WAITING_ADMIN) {
      return NextResponse.json({
        error: `Cannot mark as paid: escrow is ${escrow.status.replace('_', ' ')}`
      }, { status: 409 })
    }

    // If already waiting_admin, just return success (receipt already processed)
    if (escrow.status === ESCROW_STATUS.WAITING_ADMIN) {
      return NextResponse.json({ ok: true })
    }

    // Check if there's at least one receipt uploaded
    const { data: receipts, error: receiptsError } = await serviceClient
      .from('receipts')
      .select('id')
      .eq('escrow_id', escrow_id)
      .limit(1)

    if (receiptsError) {
      console.error('Error checking receipts:', receiptsError)
      return NextResponse.json({ error: 'Failed to verify receipts' }, { status: 500 })
    }

    if (!receipts || receipts.length === 0) {
      return NextResponse.json({
        error: 'Cannot mark as paid: no payment receipt uploaded'
      }, { status: 409 })
    }

    // Transition status from waiting_payment to waiting_admin
    if (!canTransition(escrow.status as EscrowStatus, ESCROW_STATUS.WAITING_ADMIN)) {
      return NextResponse.json({
        error: 'Invalid status transition'
      }, { status: 409 })
    }

    // Update escrow status
    const { error: updateError } = await serviceClient
      .from('escrows')
      .update({ status: ESCROW_STATUS.WAITING_ADMIN })
      .eq('id', escrow_id)

    if (updateError) {
      console.error('Error updating escrow status:', updateError)
      return NextResponse.json({ error: 'Failed to update escrow status' }, { status: 500 })
    }

    console.log('Mark-paid: Updated escrow', escrow_id, 'status from', escrow.status, 'to', ESCROW_STATUS.WAITING_ADMIN)

    // Log status change
    const { error: logError } = await serviceClient
      .from('status_logs')
      .insert({
        escrow_id: escrow_id,
        status: ESCROW_STATUS.WAITING_ADMIN,
        changed_by: user.id
      })

    if (logError) {
      console.error('Error logging status change:', logError)
      // Don't fail the request for logging errors
    }

    return NextResponse.json({ ok: true })

  } catch (error) {
    console.error('Mark paid error:', error)
    return NextResponse.json({ error: 'Failed to mark as paid' }, { status: 500 })
  }
}