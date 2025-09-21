export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClientWithAuthHeader, createServiceRoleClient } from '@/lib/supabaseServer'
import { ESCROW_STATUS } from '@/lib/status'
import { z } from 'zod'

/**
 * POST /api/escrow/edit
 *
 * Allows sellers to edit escrow details (description, price) once before buyer pays.
 * Only works when escrow status is 'created'.
 *
 * Request body:
 *   { escrowId: string, description?: string, price?: number }
 *
 * Returns:
 *   200: { success: true }
 *   400: { error: string } (validation)
 *   401: { error: string } (authentication)
 *   403: { error: string } (not seller or escrow not editable)
 *   404: { error: string } (escrow not found)
 *   500: { error: string } (server error)
 */
const editEscrowSchema = z.object({
  escrowId: z.string().uuid(),
  description: z.string().min(1).max(1000).optional(),
  price: z.number().positive().max(1000000).optional()
}).refine(data => data.description || data.price, {
  message: "At least one field (description or price) must be provided"
})

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClientWithAuthHeader(request)
    const serviceClient = createServiceRoleClient()

    // Authenticate user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Parse and validate request body
    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const validation = editEscrowSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({
        error: validation.error.errors.map(e => e.message).join(', ')
      }, { status: 400 })
    }

    const { escrowId, description, price } = validation.data

    // Get escrow and verify ownership
    const { data: escrow, error: escrowError } = await serviceClient
      .from('escrows')
      .select('id, seller_id, status, description, price')
      .eq('id', escrowId)
      .single()

    if (escrowError || !escrow) {
      return NextResponse.json({ error: 'Escrow not found' }, { status: 404 })
    }

    // Verify user is the seller
    if (escrow.seller_id !== user.id) {
      return NextResponse.json({ error: 'Only the seller can edit this escrow' }, { status: 403 })
    }

    // Check if escrow can be edited (only when status is 'created' or 'waiting_payment')
    if (escrow.status !== ESCROW_STATUS.CREATED && escrow.status !== ESCROW_STATUS.WAITING_PAYMENT) {
      return NextResponse.json({
        error: 'Escrow can only be edited before payment is confirmed'
      }, { status: 403 })
    }

    // Prepare update fields
    const updateFields: any = {}

    if (description !== undefined) {
      updateFields.description = description
    }

    if (price !== undefined) {
      updateFields.price = price
    }

    // Update escrow
    const { error: updateError } = await serviceClient
      .from('escrows')
      .update(updateFields)
      .eq('id', escrowId)

    if (updateError) {
      console.error('Error updating escrow:', updateError)
      return NextResponse.json({ error: 'Failed to update escrow' }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Unexpected error in escrow edit:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}