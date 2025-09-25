export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClientWithCookies, createServiceRoleClient } from '@/lib/supabaseServer'
import { requireRole } from '@/lib/rbac'
import { ESCROW_STATUS } from '@/lib/status'
import { z } from 'zod'

const forceCompleteSchema = z.object({
  escrowId: z.string().uuid()
})

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClientWithCookies()
    const serviceClient = createServiceRoleClient()

    // Require admin role
    const profile = await requireRole(supabase, 'admin')

    const body = await request.json()
    const { escrowId } = forceCompleteSchema.parse(body)

    // Get escrow
    const { data: escrow, error: escrowError } = await (serviceClient as any)
      .from('escrows')
      .select('*')
      .eq('id', escrowId)
      .single()

    if (escrowError || !escrow) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Admins can force complete from any active status
    // Check if escrow is already in a terminal state
    if (escrow.status === ESCROW_STATUS.COMPLETED ||
        escrow.status === ESCROW_STATUS.REFUNDED ||
        escrow.status === ESCROW_STATUS.CLOSED) {
      return NextResponse.json({
        error: 'Transaction is already in a terminal state'
      }, { status: 400 })
    }

    // Update escrow status to completed
    const { error: updateError } = await (serviceClient as any)
      .from('escrows')
      .update({ status: ESCROW_STATUS.COMPLETED })
      .eq('id', escrow.id)

    if (updateError) {
      console.error('Error updating escrow:', updateError)
      return NextResponse.json({ error: 'Failed to complete transaction' }, { status: 500 })
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
    console.error('Force complete error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input data' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to force complete transaction' }, { status: 500 })
  }
}