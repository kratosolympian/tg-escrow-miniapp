export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClientWithCookies, createServiceRoleClient } from '@/lib/supabaseServer'
import { requireAuth } from '@/lib/rbac'
import { ESCROW_STATUS, canTransition, EscrowStatus } from '@/lib/status'
import { z } from 'zod'


/**
 * POST /api/escrow/expire
 *
 * Expires an escrow when the payment deadline is reached.
 * This transitions the escrow from WAITING_PAYMENT to CLOSED status.
 * Steps:
 *   1. Authenticates the user (cookie/session)
 *   2. Validates input (escrowId)
 *   3. Checks that the escrow exists and is in WAITING_PAYMENT status
 *   4. Updates the escrow status to CLOSED
 *   5. Logs the status change
 *
 * Request body:
 *   { escrowId: string }
 *
 * Returns:
 *   200: { ok: true }
 *   400: { error: string } (validation, status)
 *   404: { error: string } (not found)
 *   500: { error: string } (update or server error)
 */
const expireSchema = z.object({
  escrowId: z.string().uuid()
})

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClientWithCookies()
    const serviceClient = createServiceRoleClient()

    const body = await request.json()
    const { escrowId } = expireSchema.parse(body)

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Get escrow details
    const { data: escrow, error: escrowError } = await serviceClient
      .from('escrows')
      .select('*')
      .eq('id', escrowId)
      .single()

    if (escrowError || !escrow) {
      return NextResponse.json({ error: 'Escrow not found' }, { status: 404 })
    }

    // Check if escrow can be expired (must be in WAITING_PAYMENT status)
    if (escrow.status !== ESCROW_STATUS.WAITING_PAYMENT) {
      return NextResponse.json({
        error: `Cannot expire escrow in ${escrow.status} status. Only WAITING_PAYMENT escrows can be expired.`
      }, { status: 400 })
    }

    // Check if transition is allowed
    if (!canTransition(escrow.status as EscrowStatus, ESCROW_STATUS.CLOSED)) {
      return NextResponse.json({
        error: 'Invalid status transition'
      }, { status: 400 })
    }

    // Update escrow status to CLOSED
    const { error: updateError } = await serviceClient
      .from('escrows')
      .update({
        status: ESCROW_STATUS.CLOSED,
        updated_at: new Date().toISOString()
      })
      .eq('id', escrowId)

    if (updateError) {
      console.error('Error updating escrow status:', updateError)
      return NextResponse.json({ error: 'Failed to expire escrow' }, { status: 500 })
    }

    // Log the status change
    const { error: logError } = await serviceClient
      .from('status_logs')
      .insert({
        escrow_id: escrowId,
        status: ESCROW_STATUS.CLOSED,
        changed_by: user.id,
        created_at: new Date().toISOString()
      })

    if (logError) {
      console.error('Error logging status change:', logError)
      // Don't fail the request if logging fails
    }

    return NextResponse.json({ ok: true })

  } catch (error) {
    console.error('Error in expire escrow:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}