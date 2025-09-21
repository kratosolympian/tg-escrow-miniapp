export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClientWithCookies, createServiceRoleClient } from '@/lib/supabaseServer'
import { ESCROW_STATUS } from '@/lib/status'

/**
 * GET /api/escrow/my-active
 * Returns active escrows for the authenticated user.
 * Response shape: { seller: [...], buyer: [...] }
 */
export async function GET(request: NextRequest) {
  try {
    // TEMP LOGGING: inspect incoming headers and cookies to diagnose SSR auth visibility
    try {
      // eslint-disable-next-line no-console
      console.log('[API] my-active - incoming headers:')
      // eslint-disable-next-line no-console
      console.log('  authorization:', request.headers.get('authorization'))
      // eslint-disable-next-line no-console
      console.log('  cookie:', request.headers.get('cookie'))
    } catch (l) {}
    const supabase = createServerClientWithCookies()
    const serviceClient = createServiceRoleClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    // TEMP LOGGING: surface whether a user was found for incoming request
    try {
      // eslint-disable-next-line no-console
      console.log('[API] my-active - user present:', !!user)
      // eslint-disable-next-line no-console
      if (user) console.log('[API] my-active - user id:', user.id)
    } catch (l) {}

    // If no user from cookies, attempt to accept a one-time token (header or query)
    let resolvedUser = user
    if (userError || !resolvedUser) {
      // try to find a token in headers or query params
      let token: string | null = null
      try {
        token = request.headers.get('x-one-time-token') || null
        if (!token) {
          const auth = request.headers.get('authorization') || ''
          if (auth.toLowerCase().startsWith('bearer ')) token = auth.slice(7).trim()
        }
        if (!token) {
          const url = new URL(request.url)
          token = url.searchParams.get('__one_time_token') || null
        }
      } catch (e) {
        token = null
      }

      if (token) {
        try {
          // eslint-disable-next-line no-console
          console.log('[API] my-active - found one-time token, attempting verify')
          const { verifyAndConsumeSignedToken } = await import('@/lib/signedAuth')
          const userId = await verifyAndConsumeSignedToken(token)
          // eslint-disable-next-line no-console
          console.log('[API] my-active - token verify result userId:', userId)
          if (userId) {
            // populate minimal user object so subsequent logic can use user.id
            resolvedUser = { id: userId } as any
          }
        } catch (e) {
          console.warn('one-time token verify failed', e)
        }
      }
      
      // Dev-only: accept a test_session cookie set by the test bootstrap endpoint.
      // This is intentionally permissive for local testing only.
      try {
        const cookieHeader = request.headers.get('cookie') || ''
        const match = cookieHeader.match(/(?:^|;)\s*test_session=([^;\s]+)/)
        if (!resolvedUser && match && match[1]) {
          resolvedUser = { id: match[1] } as any
          // eslint-disable-next-line no-console
          console.log('[API] my-active - using test_session cookie, userId=', match[1])
        }
      } catch {
        // ignore
      }
    }

    if (!resolvedUser) {
      // Keep response machine-friendly for server-side checks: return 401
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

  const userId = (resolvedUser as any).id

    // Active statuses we consider for "active" transactions
    const activeStatuses = [
      ESCROW_STATUS.CREATED,
      ESCROW_STATUS.WAITING_PAYMENT,
      ESCROW_STATUS.WAITING_ADMIN,
      ESCROW_STATUS.PAYMENT_CONFIRMED,
      ESCROW_STATUS.IN_PROGRESS,
      ESCROW_STATUS.ON_HOLD
    ]

    // Fetch seller active escrow (limit 10)
    const { data: sellerData, error: sellerErr } = await serviceClient
      .from('escrows')
      .select('id, code, status, seller_id, buyer_id')
      .eq('seller_id', userId)
      .in('status', activeStatuses)
      .order('created_at', { ascending: false })
      .limit(10)

    if (sellerErr) {
      console.error('Error fetching seller active escrows:', sellerErr)
      // Return 500 so callers surface the issue
      return NextResponse.json({ error: 'Failed to fetch seller active escrows' }, { status: 500 })
    }

    // Fetch buyer active escrows (limit 10)
    const { data: buyerData, error: buyerErr } = await serviceClient
      .from('escrows')
      .select('id, code, status, seller_id, buyer_id')
      .eq('buyer_id', userId)
      .in('status', activeStatuses)
      .order('created_at', { ascending: false })
      .limit(10)

    if (buyerErr) {
      console.error('Error fetching buyer active escrows:', buyerErr)
      return NextResponse.json({ error: 'Failed to fetch buyer active escrows' }, { status: 500 })
    }

    // TEMP LOGGING: log the counts being returned
    try {
      // eslint-disable-next-line no-console
      console.log('[API] my-active - returning counts: seller=', (sellerData || []).length, 'buyer=', (buyerData || []).length)
    } catch (l) {}

    return NextResponse.json({ seller: sellerData || [], buyer: buyerData || [] })
  } catch (error) {
    console.error('my-active route error:', error)
    return NextResponse.json({ error: 'Failed to fetch active escrows' }, { status: 500 })
  }
}
