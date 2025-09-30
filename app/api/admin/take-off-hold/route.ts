export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClientWithCookies, createServiceRoleClient } from '@/lib/supabaseServer'
import { requireRole } from '@/lib/rbac'
import { ESCROW_STATUS, canTransition, EscrowStatus } from '@/lib/status'
import { z } from 'zod'
import { sendEscrowStatusNotification } from '@/lib/telegram'

const takeOffHoldSchema = z.object({
  escrowId: z.string().uuid()
})

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClientWithCookies()
    const serviceClient = createServiceRoleClient()

    // Require admin role
    const profile = await requireRole(supabase, 'admin')

    const body = await request.json()
    const { escrowId } = takeOffHoldSchema.parse(body)

    // Get escrow
    const { data: escrow, error: escrowError } = await (serviceClient as any)
      .from('escrows')
      .select('*')
      .eq('id', escrowId)
      .single()

    if (escrowError || !escrow) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Check if escrow is currently on hold
    if (escrow.status !== ESCROW_STATUS.ON_HOLD) {
      return NextResponse.json({
        error: 'Transaction is not on hold'
      }, { status: 400 })
    }

    // Determine the appropriate state to resume to
    // Find the most recent status before ON_HOLD from status_logs
    const { data: statusLogs, error: logsError } = await (serviceClient as any)
      .from('status_logs')
      .select('status')
      .eq('escrow_id', escrowId)
      .neq('status', ESCROW_STATUS.ON_HOLD)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let resumeStatus: EscrowStatus = ESCROW_STATUS.WAITING_ADMIN // default fallback

    if (!logsError && statusLogs) {
      // Check if we can transition back to the previous status
      const previousStatus = statusLogs.status as EscrowStatus
      if (canTransition(ESCROW_STATUS.ON_HOLD, previousStatus)) {
        resumeStatus = previousStatus
      }
    }

    // Check if can transition to resume status
    if (!canTransition(ESCROW_STATUS.ON_HOLD, resumeStatus)) {
      return NextResponse.json({
        error: 'Cannot resume transaction from hold status'
      }, { status: 400 })
    }

    // Update escrow status to resume
    const { error: updateError } = await (serviceClient as any)
      .from('escrows')
      .update({ status: resumeStatus })
      .eq('id', escrow.id)

    if (updateError) {
      console.error('Error updating escrow:', updateError)
      return NextResponse.json({ error: 'Failed to resume transaction' }, { status: 500 })
    }

    // Send Telegram notifications
    await sendEscrowStatusNotification(escrow.id, escrow.status, resumeStatus, serviceClient)

    // Log status change
    await (serviceClient as any)
      .from('status_logs')
      .insert({
        escrow_id: escrow.id,
        status: resumeStatus,
        changed_by: profile.id
      })

    return NextResponse.json({ ok: true })

  } catch (error) {
    console.error('Take off hold error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input data' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to take transaction off hold' }, { status: 500 })
  }
}