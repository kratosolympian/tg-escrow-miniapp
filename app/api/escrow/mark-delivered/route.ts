export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClientWithAuthHeader, createServiceRoleClient } from '@/lib/supabaseServer'
import { requireAuth } from '@/lib/rbac'
import { ESCROW_STATUS, canTransition, EscrowStatus } from '@/lib/status'
import { z } from 'zod'


/**
 * POST /api/escrow/mark-delivered
 *
 * Allows the seller to mark an escrow as delivered, optionally attaching delivery proof.
 * Steps:
 *   1. Authenticates the user (cookie/session)
 *   2. Validates input (escrowId, deliveryProof)
 *   3. Checks that the user is the seller
 *   4. Checks that the escrow is in a state that can be marked as delivered
 *   5. Updates the escrow status and saves delivery proof if provided
 *
 * Request body:
 *   { escrowId: string, deliveryProof?: string }
 *
 * Returns:
 *   200: { ok: true }
 *   400: { error: string } (validation, status)
 *   403: { error: string } (not seller)
 *   404: { error: string } (not found)
 *   500: { error: string } (update or server error)
 */
const markDeliveredSchema = z.object({
  escrowId: z.string().uuid(),
  deliveryProof: z.string().optional(), // file path or URL
  __one_time_token: z.string().optional()
})

export async function POST(request: NextRequest) {
  try {
  const supabase = createServerClientWithAuthHeader(request)
    const serviceClient = createServiceRoleClient()
    
    // Check for one-time token first
    let authenticatedUser = null
    const body = await request.json()
    const { escrowId: requestEscrowId, deliveryProof: requestDeliveryProof, __one_time_token } = body

    if (__one_time_token) {
      try {
        const { verifyAndConsumeSignedToken } = await import('@/lib/signedAuth')
        console.debug('Mark delivered: one-time token present')
        const userId = await verifyAndConsumeSignedToken(__one_time_token)
        console.debug('Mark delivered: verifyAndConsumeSignedToken result ok=', !!userId)
        if (userId) {
          authenticatedUser = { id: userId }
        } else {
          console.warn('Mark delivered: one-time token present but not valid/expired')
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
    const { escrowId, deliveryProof } = markDeliveredSchema.parse(body)

    // Get escrow
    const { data: escrow, error: escrowError } = await serviceClient
      .from('escrows')
      .select('*')
      .eq('id', escrowId)
      .single()

    if (escrowError || !escrow) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Check if user is the seller
    if (escrow.seller_id !== profile.id) {
      return NextResponse.json({ error: 'Only the seller can mark as delivered' }, { status: 403 })
    }

    // Check if can transition from payment_confirmed to in_progress
    if (!canTransition(escrow.status as EscrowStatus, ESCROW_STATUS.IN_PROGRESS)) {
      return NextResponse.json({ 
        error: 'Cannot mark as delivered in current status' 
      }, { status: 400 })
    }

    // Update escrow status and save delivery proof if provided
    const updateFields: any = { status: ESCROW_STATUS.IN_PROGRESS }
    if (deliveryProof) {
      updateFields.delivery_proof_url = deliveryProof
    }
    const { error: updateError } = await serviceClient
      .from('escrows')
      .update(updateFields)
      .eq('id', escrow.id)

    if (updateError) {
      console.error('Error updating escrow:', updateError)
      return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 })
    }

    // Log status change
    await serviceClient
      .from('status_logs')
      .insert({
        escrow_id: escrow.id,
        status: ESCROW_STATUS.IN_PROGRESS,
        changed_by: profile.id
      })

    return NextResponse.json({ ok: true })

  } catch (error) {
    console.error('Mark delivered error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input data' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to mark as delivered' }, { status: 500 })
  }
}
