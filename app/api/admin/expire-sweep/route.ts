import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabaseServer'
import { ESCROW_STATUS } from '@/lib/status'

export async function POST(request: NextRequest) {
  try {
    const service = createServiceRoleClient()

    // Close escrows that were waiting for payment and have expired
    const now = new Date().toISOString()
    const { data, error } = await (service as any)
      .from('escrows')
      .select('id')
      .lt('expires_at', now)
      .eq('status', ESCROW_STATUS.WAITING_PAYMENT)

    if (error) {
      console.error('Expire sweep query error:', error)
      return NextResponse.json({ error: 'Sweep failed' }, { status: 500 })
    }

    const ids = (data || []).map((r: any) => r.id)
    if (ids.length === 0) {
      return NextResponse.json({ closed: 0 })
    }

    const { error: updateErr } = await (service as any)
      .from('escrows')
      .update({ status: ESCROW_STATUS.CLOSED })
      .in('id', ids)

    if (updateErr) {
      console.error('Expire sweep update error:', updateErr)
      return NextResponse.json({ error: 'Sweep update failed' }, { status: 500 })
    }

    // Optionally log status changes — keep it simple for now
    return NextResponse.json({ closed: ids.length })
  } catch (error) {
    console.error('Expire sweep error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
