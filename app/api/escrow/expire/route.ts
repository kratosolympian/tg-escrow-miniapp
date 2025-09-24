import { NextRequest, NextResponse } from 'next/server'
import { createServerClientWithAuthHeader, createServiceRoleClient } from '@/lib/supabaseServer'
import { ESCROW_STATUS } from '@/lib/status'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClientWithAuthHeader(request)
    const service = createServiceRoleClient()

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { escrowId } = await request.json()
    if (!escrowId) {
      return NextResponse.json({ error: 'Escrow ID required' }, { status: 400 })
    }

    // Get the escrow to check if user is involved and if it's expired
    const { data: escrow, error: escrowError } = await service
      .from('escrows')
      .select('id, status, expires_at, buyer_id, seller_id, created_at')
      .eq('id', escrowId)
      .single()

    if (escrowError || !escrow) {
      console.error('Expire API: Escrow not found:', escrowError)
      return NextResponse.json({ error: 'Escrow not found' }, { status: 404 })
    }

    console.log('Expire API: Found escrow:', {
      id: escrow.id,
      status: escrow.status,
      expires_at: escrow.expires_at,
      created_at: escrow.created_at,
      buyer_id: escrow.buyer_id,
      seller_id: escrow.seller_id
    })

    // Check if user is involved in this escrow
    if (escrow.buyer_id !== user.id && escrow.seller_id !== user.id) {
      console.error('Expire API: User not authorized:', { userId: user.id, buyerId: escrow.buyer_id, sellerId: escrow.seller_id })
      return NextResponse.json({ error: 'Not authorized to expire this escrow' }, { status: 403 })
    }

    // Ensure the API is only invoked for valid statuses
    const validStatuses = [ESCROW_STATUS.WAITING_PAYMENT.toLowerCase(), ESCROW_STATUS.IN_PROGRESS.toLowerCase()];
    if (!validStatuses.includes(escrow.status.toLowerCase())) {
      console.error('Expire API: Escrow not in valid status for expiration:', escrow.status);
      return NextResponse.json({ error: 'Escrow cannot be expired in its current status' }, { status: 400 });
    }

    // Check if escrow is in waiting_payment or in_progress status
    if (escrow.status !== ESCROW_STATUS.WAITING_PAYMENT && escrow.status !== ESCROW_STATUS.IN_PROGRESS) {
      console.error('Expire API: Escrow not in expirable status:', escrow.status)
      return NextResponse.json({ error: 'Escrow is not in a status that can be expired' }, { status: 400 })
    }

    const now = new Date()
    const deadline = escrow.expires_at ? new Date(escrow.expires_at) : null
    const GRACE_MS = 30000; // 30 seconds grace period

    console.log('Expire API: Deadline check:', {
      now: now.toISOString(),
      deadline: deadline?.toISOString(),
      isExpired: deadline ? now.getTime() >= deadline.getTime() && now.getTime() <= deadline.getTime() + GRACE_MS : 'no deadline set',
      timeDiff: deadline ? (now.getTime() - deadline.getTime()) / 1000 : 'N/A',
      status: escrow.status
    });

    // For in_progress escrows without a deadline, allow expiration (they should have been given a deadline)
    // For escrows with deadlines, check if expired or within grace period
    const isExpired = !deadline || (now.getTime() >= deadline.getTime() && now.getTime() <= deadline.getTime() + GRACE_MS);

    if (!isExpired) {
      console.error('Expire API: Deadline not passed or within grace period');
      return NextResponse.json({ error: 'Payment deadline has not passed yet or is outside the grace period' }, { status: 400 })
    }

    // Expire the escrow
    const { error: updateError } = await service
      .from('escrows')
      .update({ status: ESCROW_STATUS.CLOSED })
      .eq('id', escrowId)

    if (updateError) {
      console.error('Expire API: Error updating escrow status:', updateError)
      return NextResponse.json({ error: 'Failed to expire escrow' }, { status: 500 })
    }

    console.log('Expire API: Successfully expired escrow:', escrowId)
    return NextResponse.json({ success: true, message: 'Escrow expired successfully' })
  } catch (error) {
    console.error('Expire escrow error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}