export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClientWithCookies, createServiceRoleClient } from '@/lib/supabaseServer'
import { requireAuth } from '@/lib/rbac'
import { ESCROW_STATUS, canTransition, EscrowStatus } from '@/lib/status'
import { z } from 'zod'


/**
 * POST /api/escrow/confirm-received
 *
 * Allows the buyer to confirm receipt of goods/services, completing the escrow.
 * Steps:
 *   1. Authenticates the user (cookie/session)
 *   2. Validates input (escrowId)
 *   3. Checks that the user is the buyer
 *   4. Checks that the escrow is in a state that can be completed
 *   5. Updates the escrow status to completed
 *   6. Logs the status change
 *
 * Request body:
 *   { escrowId: string }
 *
 * Returns:
 *   200: { ok: true }
 *   400: { error: string } (validation, status)
 *   403: { error: string } (not buyer)
 *   404: { error: string } (not found)
 *   500: { error: string } (update or server error)
 */
const confirmReceivedSchema = z.object({
  escrowId: z.string().uuid(),
  __one_time_token: z.string().optional()
})

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClientWithCookies()
    const serviceClient = createServiceRoleClient()
    
    // Check for one-time token first
    let authenticatedUser = null
    const body = await request.json()
    const { escrowId, __one_time_token } = body

    if (__one_time_token) {
      try {
        const { verifyAndConsumeSignedToken } = await import('@/lib/signedAuth')
        console.debug('Confirm received: one-time token present')
        const userId = await verifyAndConsumeSignedToken(__one_time_token)
        console.debug('Confirm received: verifyAndConsumeSignedToken result ok=', !!userId)
        if (userId) {
          authenticatedUser = { id: userId }
        } else {
          console.warn('Confirm received: one-time token present but not valid/expired')
          return NextResponse.json({ error: 'Invalid or expired one-time token' }, { status: 401 })
        }
      } catch (e) {
        console.warn('Error importing/verifying one-time token')
      }
    }

    // Fallback to requireAuth if no token
    let profile = authenticatedUser
    if (!profile) {
      profile = await requireAuth(supabase)
    }
    
    // Parse and validate the request data
    const validatedData = confirmReceivedSchema.parse(body)
    const escrowIdValidated = validatedData.escrowId

    // Get escrow
    const { data: escrow, error: escrowError } = await (serviceClient as any)
      .from('escrows')
      .select('*')
      .eq('id', escrowId)
      .single()

    if (escrowError || !escrow) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Check if user is the buyer
    if (escrow.buyer_id !== profile.id) {
      return NextResponse.json({ error: 'Only the buyer can confirm receipt' }, { status: 403 })
    }

    console.log('Confirm received: escrow status is', escrow.status, 'for escrow', escrowId)

    // If already completed, just return success (handles race conditions)
    if (escrow.status === ESCROW_STATUS.COMPLETED) {
      console.log('Confirm received: escrow is already completed, returning success')
      return NextResponse.json({ ok: true })
    }

    // Check if can transition from in_progress to completed
    if (!canTransition(escrow.status as EscrowStatus, ESCROW_STATUS.COMPLETED)) {
      console.log('Confirm received: cannot transition from', escrow.status, 'to completed')
      return NextResponse.json({ 
        error: 'Cannot confirm receipt in current status' 
      }, { status: 400 })
    }

    // Update escrow status
    const { error: updateError } = await (serviceClient as any)
      .from('escrows')
      .update({ status: ESCROW_STATUS.COMPLETED })
      .eq('id', escrow.id)

    if (updateError) {
      console.error('Error updating escrow:', updateError)
      return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 })
    }

    // Log status change
    await (serviceClient as any)
      .from('status_logs')
      .insert({
        escrow_id: escrow.id,
        status: ESCROW_STATUS.COMPLETED,
        changed_by: profile.id
      })

    return NextResponse.json({ ok: true })

  } catch (error) {
    console.error('Confirm received error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input data' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to confirm receipt' }, { status: 500 })
  }
}
