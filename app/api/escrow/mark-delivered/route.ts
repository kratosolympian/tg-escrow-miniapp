import { NextRequest, NextResponse } from 'next/server'
import { createServerClientWithCookies } from '@/lib/supabaseServer'
import { requireAuth } from '@/lib/rbac'
import { ESCROW_STATUS, canTransition } from '@/lib/status'
import { z } from 'zod'

const markDeliveredSchema = z.object({
  escrowId: z.string().uuid()
})

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClientWithCookies()
    
    // Require authentication
    const profile = await requireAuth(supabase)
    
    const body = await request.json()
    const { escrowId } = markDeliveredSchema.parse(body)

    // Get escrow
    const { data: escrow, error: escrowError } = await (supabase as any)
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
    if (!canTransition(escrow.status, ESCROW_STATUS.IN_PROGRESS)) {
      return NextResponse.json({ 
        error: 'Cannot mark as delivered in current status' 
      }, { status: 400 })
    }

    // Update escrow status
    const { error: updateError } = await (supabase as any)
      .from('escrows')
      .update({ status: ESCROW_STATUS.IN_PROGRESS })
      .eq('id', escrow.id)

    if (updateError) {
      console.error('Error updating escrow:', updateError)
      return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 })
    }

    // Log status change
    await (supabase as any)
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
