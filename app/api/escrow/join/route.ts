import { NextRequest, NextResponse } from 'next/server'
import { createServerClientWithCookies } from '@/lib/supabaseServer'
import { requireAuth } from '@/lib/rbac'
import { ESCROW_STATUS, canTransition } from '@/lib/status'
import { z } from 'zod'

const joinEscrowSchema = z.object({
  code: z.string().min(1)
})

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClientWithCookies()
    
    // Require authentication
    const profile = await requireAuth(supabase)
    
    const body = await request.json()
    const { code } = joinEscrowSchema.parse(body)

    // Find escrow by code
    const { data: escrow, error: findError } = await (supabase as any)
      .from('escrows')
      .select('*')
      .eq('code', code.toUpperCase())
      .single()

    if (findError || !escrow) {
      return NextResponse.json({ error: 'Transaction code not found' }, { status: 404 })
    }

    // Check if already joined
    if (escrow.buyer_id) {
      if (escrow.buyer_id === profile.id) {
        return NextResponse.json({ error: 'You have already joined this transaction' }, { status: 400 })
      } else {
        return NextResponse.json({ error: 'This transaction already has a buyer' }, { status: 400 })
      }
    }

    // Check if seller is trying to join their own escrow
    if (escrow.seller_id === profile.id) {
      return NextResponse.json({ error: 'You cannot join your own transaction as a buyer' }, { status: 400 })
    }

    // Check status transition
    if (!canTransition(escrow.status, ESCROW_STATUS.WAITING_PAYMENT)) {
      return NextResponse.json({ error: 'Cannot join transaction in current status' }, { status: 400 })
    }

    // Update escrow with buyer and new status
    const { error: updateError } = await (supabase as any)
      .from('escrows')
      .update({
        buyer_id: profile.id,
        status: ESCROW_STATUS.WAITING_PAYMENT
      })
      .eq('id', (escrow as any).id)

    if (updateError) {
      console.error('Error updating escrow:', updateError)
      return NextResponse.json({ error: 'Failed to join transaction' }, { status: 500 })
    }

    // Log status change
    await (supabase as any)
      .from('status_logs')
      .insert({
        escrow_id: (escrow as any).id,
        status: ESCROW_STATUS.WAITING_PAYMENT,
        changed_by: profile.id
      })

    return NextResponse.json({ ok: true, escrowId: (escrow as any).id })

  } catch (error) {
    console.error('Join escrow error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input data' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to join transaction' }, { status: 500 })
  }
}
