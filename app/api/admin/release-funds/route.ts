import { NextRequest, NextResponse } from 'next/server'
import { createServerClientWithCookies } from '@/lib/supabaseServer'
import { requireRole } from '@/lib/rbac'
import { ESCROW_STATUS, canTransition } from '@/lib/status'
import { z } from 'zod'

const releaseFundsSchema = z.object({
  escrowId: z.string().uuid()
})

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClientWithCookies()
    
    // Require admin role
    const profile = await requireRole(supabase, 'admin')
    
    const body = await request.json()
    const { escrowId } = releaseFundsSchema.parse(body)

    // Get escrow
    const { data: escrow, error: escrowError } = await supabase
      .from('escrows')
      .select('*')
      .eq('id', escrowId)
      .single()

    if (escrowError || !escrow) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Check if can transition from completed to closed
    if (!canTransition(escrow.status, ESCROW_STATUS.CLOSED)) {
      return NextResponse.json({ 
        error: 'Cannot release funds in current status' 
      }, { status: 400 })
    }

    // Update escrow status
    const { error: updateError } = await supabase
      .from('escrows')
      .update({ status: ESCROW_STATUS.CLOSED })
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
        status: ESCROW_STATUS.CLOSED,
        changed_by: profile.id
      })

    return NextResponse.json({ ok: true })

  } catch (error) {
    console.error('Release funds error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input data' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to release funds' }, { status: 500 })
  }
}
