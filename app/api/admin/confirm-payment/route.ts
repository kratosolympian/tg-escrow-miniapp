import { NextRequest, NextResponse } from 'next/server'
import { createServerClientWithCookies } from '@/lib/supabaseServer'
import { requireRole } from '@/lib/rbac'
import { ESCROW_STATUS, canTransition } from '@/lib/status'
import { z } from 'zod'

const confirmPaymentSchema = z.object({
  escrowId: z.string().uuid()
})

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClientWithCookies()
    
    // Require admin role
    const profile = await requireRole(supabase, 'admin')
    
    const body = await request.json()
    const { escrowId } = confirmPaymentSchema.parse(body)

    // Get escrow
    const { data: escrow, error: escrowError } = await supabase
      .from('escrows')
      .select('*')
      .eq('id', escrowId)
      .single()

    if (escrowError || !escrow) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Check if can transition from waiting_admin to payment_confirmed
    if (!canTransition(escrow.status, ESCROW_STATUS.PAYMENT_CONFIRMED)) {
      return NextResponse.json({ 
        error: 'Cannot confirm payment in current status' 
      }, { status: 400 })
    }

    // Update escrow status
    const { error: updateError } = await supabase
      .from('escrows')
      .update({ status: ESCROW_STATUS.PAYMENT_CONFIRMED })
      .eq('id', escrow.id)

    if (updateError) {
      console.error('Error updating escrow:', updateError)
      return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 })
    }

    // Log status change
    await supabase
      .from('status_logs')
      .insert({
        escrow_id: escrow.id,
        status: ESCROW_STATUS.PAYMENT_CONFIRMED,
        changed_by: profile.id
      })

    return NextResponse.json({ ok: true })

  } catch (error) {
    console.error('Confirm payment error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input data' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to confirm payment' }, { status: 500 })
  }
}
