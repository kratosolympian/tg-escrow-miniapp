// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createServerClientWithCookies, createServiceRoleClient } from '@/lib/supabaseServer'
import { ESCROW_STATUS, canTransition } from '@/lib/status'
import { z } from 'zod'

const joinEscrowSchema = z.object({
  code: z.string().min(1)
})

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClientWithCookies()
    const serviceClient = createServiceRoleClient()

    // Attempt to get authenticated user from cookies
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    // If no user in cookies, allow one-time token authentication (used after API signup)
    let authenticatedUser = user
    if (!authenticatedUser) {
      const bodyPeek = await request.clone().json().catch(() => ({}))
      const token = (bodyPeek && bodyPeek.__one_time_token) || null
      console.debug('Join route: peeked body, token=', token, 'bodyPeek=', bodyPeek)

  if (token) {
        try {
          const { consumeOneTimeToken } = await import('@/lib/ephemeralAuth')
          const userId = consumeOneTimeToken(token)
          console.debug('Join route: consumeOneTimeToken result=', userId)
          if (userId) {
            // attach a lightweight user object for downstream logic
            authenticatedUser = { id: userId }
          }
          else {
            console.warn('Join route: one-time token present but not valid/expired')
            return NextResponse.json({ error: 'Invalid or expired one-time token' }, { status: 401 })
          }
        } catch (e) {
          console.warn('Error importing/consuming one-time token', e)
        }
      }
    }

    if (!authenticatedUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    
    const body = await request.json()
    const { code } = joinEscrowSchema.parse(body)

    // Find escrow by code using service client
    const { data: escrow, error: findError } = await serviceClient
      .from('escrows')
      .select('*')
      .eq('code', code.toUpperCase())
      .single()

    if (findError || !escrow) {
      console.error('Escrow find error:', findError)
      return NextResponse.json({ error: 'Transaction code not found' }, { status: 404 })
    }

    // Check if already joined
    if ((escrow as any).buyer_id) {
      if ((escrow as any).buyer_id === authenticatedUser.id) {
        return NextResponse.json({ error: 'You have already joined this transaction' }, { status: 400 })
      } else {
        return NextResponse.json({ error: 'This transaction already has a buyer' }, { status: 400 })
      }
    }

    // Check if seller is trying to join their own escrow
  if ((escrow as any).seller_id === authenticatedUser.id) {
      return NextResponse.json({ error: 'You cannot join your own transaction as a buyer' }, { status: 400 })
    }

    // Check status transition
    if (!canTransition((escrow as any).status, ESCROW_STATUS.WAITING_PAYMENT)) {
      return NextResponse.json({ error: 'Cannot join transaction in current status' }, { status: 400 })
    }

    // Update escrow with buyer and new status using service client
    // @ts-ignore
    const { error: updateError } = await serviceClient
      .from('escrows')
      .update({
        buyer_id: authenticatedUser.id,
        status: ESCROW_STATUS.WAITING_PAYMENT
      })
      .eq('id', (escrow as any).id)

    if (updateError) {
      console.error('Error updating escrow:', updateError)
      return NextResponse.json({ error: 'Failed to join transaction' }, { status: 500 })
    }

    // Log status change using service client
    // @ts-ignore
    const { error: logError } = await serviceClient
      .from('status_logs')
      .insert({
        escrow_id: (escrow as any).id,
        status: ESCROW_STATUS.WAITING_PAYMENT,
        changed_by: authenticatedUser.id
      })

    if (logError) {
      console.error('Error logging status:', logError)
      // Don't fail the request if logging fails
    }

    return NextResponse.json({ ok: true, escrowId: (escrow as any).id })

  } catch (error) {
    console.error('Join escrow error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input data' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to join transaction' }, { status: 500 })
  }
}
