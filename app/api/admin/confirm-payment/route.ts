import { NextRequest, NextResponse } from 'next/server'
import { createServerClientWithCookies, createServiceRoleClient } from '@/lib/supabaseServer'
import { requireRole } from '@/lib/rbac'
import { ESCROW_STATUS, canTransition, EscrowStatus } from '@/lib/status'
import { z } from 'zod'
import { Escrow } from '@/lib/types'
import { sendEscrowStatusNotification } from '@/lib/telegram'

const confirmPaymentSchema = z.object({
  escrowId: z.string().uuid()
})

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClientWithCookies()
    const serviceClient = createServiceRoleClient()

    // Require admin role
    const profile = await requireRole(supabase, 'admin')
    
    const body = await request.json()
    const { escrowId } = confirmPaymentSchema.parse(body)

    // Get escrow
    const { data: escrow, error: escrowError } = await (supabase as any)
      .from('escrows')
      .select('*')
      .eq('id', escrowId)
      .single()

    if (escrowError || !escrow) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Check if can transition from waiting_admin to payment_confirmed
    if (!canTransition(escrow.status as EscrowStatus, ESCROW_STATUS.PAYMENT_CONFIRMED)) {
      return NextResponse.json({ 
        error: 'Cannot confirm payment in current status' 
      }, { status: 400 })
    }

    // Update escrow status
    const { error: updateError } = await (supabase as any)
      .from('escrows')
      .update({ status: ESCROW_STATUS.PAYMENT_CONFIRMED })
      .eq('id', escrow.id)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 })
    }

    // Send Telegram notifications
    await sendEscrowStatusNotification(escrow.id, escrow.status, ESCROW_STATUS.PAYMENT_CONFIRMED, supabase, process.env.TELEGRAM_MINIAPP_URL, profile.id)

    // Log status change
    const { error: logError } = await (supabase as any)
      .from('status_logs')
      .insert({
        escrow_id: escrow.id,
        status: ESCROW_STATUS.PAYMENT_CONFIRMED,
        changed_by: null // Admin action
      })

    if (logError) {
      console.error('Failed to log status change:', logError)
    }

    return NextResponse.json({ ok: true })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input data' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to confirm payment' }, { status: 500 })
  }
}
