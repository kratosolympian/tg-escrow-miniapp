export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClientWithAuthHeader, createServiceRoleClient, createServerClientWithCookies } from '@/lib/supabaseServer'
import { ESCROW_STATUS, canTransition, EscrowStatus } from '@/lib/status'
import { z } from 'zod'
import { sendEscrowStatusNotification } from '@/lib/telegram'


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
    
    // Prefer session auth (Authorization bearer or cookies). If that fails, accept a one-time token.
    const body = await request.json()
    const { escrowId: bodyEscrowId, __one_time_token } = body

    const authHeader = request.headers.get('authorization') || ''
    let authenticatedUser = null

    // Try Authorization bearer as a session token first
    if (authHeader.toLowerCase().startsWith('bearer ')) {
      try {
        const supabaseAuth = createServerClientWithAuthHeader(request)
        const { data: { user }, error: userErr } = await supabaseAuth.auth.getUser()
  console.info('Confirm received: auth header session lookup', user ? user.id : null)
        if (user) authenticatedUser = { id: user.id }
      } catch (e) {
        console.warn('Confirm received: auth.getUser with Authorization header failed, will try cookies/one-time token', e)
      }
    }

    // Try cookie-based session if still unauthenticated
    if (!authenticatedUser) {
      try {
        const serverSupabase = createServerClientWithCookies()
        const { data: { user }, error: userErr } = await serverSupabase.auth.getUser()
  console.info('Confirm received: cookie session lookup', user ? user.id : null)
        if (user) authenticatedUser = { id: user.id }
      } catch (e) {
        console.warn('Confirm received: cookie-based auth failed, will try one-time token', e)
      }
    }

    // If still not authenticated, try one-time token from body or headers
    if (!authenticatedUser) {
      let oneTimeToken = __one_time_token || null
      const headerToken = request.headers.get('x-one-time-token') || null
      if (headerToken) oneTimeToken = headerToken
      if (!oneTimeToken && authHeader.toLowerCase().startsWith('bearer ')) {
        oneTimeToken = authHeader.slice(7).trim()
      }
      if (oneTimeToken) {
        try {
          const { verifyAndConsumeSignedToken } = await import('@/lib/signedAuth')
          // One-time token present; attempt verification
          const userId = await verifyAndConsumeSignedToken(oneTimeToken)
          if (userId) {
            authenticatedUser = { id: userId }
          } else {
            console.warn('Confirm received: one-time token present but not valid/expired')
            return NextResponse.json({ error: 'Invalid or expired one-time token' }, { status: 401 })
          }
        } catch (e) {
          console.warn('Error importing/verifying one-time token', e)
        }
      }
    }

    if (!authenticatedUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    
  // Parse and validate the request data
  const validatedData = confirmReceivedSchema.parse(body)
  const escrowIdValidated = validatedData.escrowId
    // Establish profile from authenticated user
    const profile = authenticatedUser

    // Get escrow
  console.info('Confirm received: acting as profile', { id: profile?.id, escrowId: escrowIdValidated })
    const { data: escrow, error: escrowError } = await (serviceClient as any)
      .from('escrows')
      .select('*')
      .eq('id', escrowIdValidated)
      .single()

    if (escrowError || !escrow) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Check if user is the buyer
    if (escrow.buyer_id !== profile.id) {
      return NextResponse.json({ error: 'Only the buyer can confirm receipt' }, { status: 403 })
    }

    // If already completed, just return success (handles race conditions)
    if (escrow.status === ESCROW_STATUS.COMPLETED) {
      return NextResponse.json({ ok: true })
    }

    // Check if can transition from in_progress to completed
    if (!canTransition(escrow.status as EscrowStatus, ESCROW_STATUS.COMPLETED)) {
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

    // Send notification about escrow completion
    try {
      await sendEscrowStatusNotification(
        escrow.id,
        escrow.status, // old status
        ESCROW_STATUS.COMPLETED, // new status
        serviceClient,
        process.env.TELEGRAM_MINIAPP_URL,
        authenticatedUser.id // Add the user who made the change
      );
    } catch (notificationError) {
      console.error('Error sending escrow completion notification:', notificationError);
      // Don't fail the completion if notification fails
    }

    return NextResponse.json({ ok: true })

  } catch (error) {
    console.error('Confirm received error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input data' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to confirm receipt' }, { status: 500 })
  }
}
