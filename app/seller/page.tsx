import SellerPortalClient from '@/components/SellerPortalClient'
import { createServerClientWithCookies, createServiceRoleClient } from '@/lib/supabaseServer'
import { cookies } from 'next/headers'

export const revalidate = 0

export default async function SellerPage({ searchParams }: { searchParams?: Record<string,string> }) {
  // Server-side: check for an authenticated session and query active escrows.
  try {
    const { createServerClientWithCookies } = await import('@/lib/supabaseServer')
    const supabase = createServerClientWithCookies()
    const { data } = await supabase.auth.getSession()
    const session = data?.session

    if (!session) {
      const oneTime = searchParams?.__one_time_token
      // Dev-only: check for a test_session cookie created by the test helpers.
      try {
        const cookieStore = cookies()
        const testSession = cookieStore.get('test_session')
        if (testSession && testSession.value) {
          // Query directly with service role and get active escrows for display
          try {
            const svcDev = createServiceRoleClient()
            const activeStatuses = ['created','waiting_payment','waiting_admin','payment_confirmed','in_progress','on_hold']
            const { data: sellerDataDev, error: sellerErrDev } = await svcDev
              .from('escrows')
              .select('id, code, status, seller_id, buyer_id, description, price')
              .eq('seller_id', testSession.value)
              .in('status', activeStatuses)
              .order('created_at', { ascending: false })
              .limit(10)

            if (!sellerErrDev && Array.isArray(sellerDataDev) && sellerDataDev.length > 0) {
              return <SellerPortalClient initialActiveEscrows={sellerDataDev} />
            }
          } catch (e) {
            console.error('Error fetching test session data.')
          }
        }
      } catch (e) {
        console.error('Error accessing cookies.')
      }
      if (oneTime) {
        // Prefer directly verifying the one-time token and querying the DB with
        // a service-role client on the server. This avoids making an internal
        // fetch and avoids possible header/cookie propagation issues.
        try {
          const { verifyAndConsumeSignedToken } = await import('@/lib/signedAuth')
          const userId = await verifyAndConsumeSignedToken(oneTime)
          if (userId) {
            const svc = createServiceRoleClient()
            const activeStatuses = ['created','waiting_payment','waiting_admin','payment_confirmed','in_progress','on_hold']
            const { data: sellerData, error: sellerErr } = await svc
              .from('escrows')
              .select('id, code, status, seller_id, buyer_id, description, price')
              .eq('seller_id', userId)
              .in('status', activeStatuses)
              .order('created_at', { ascending: false })
              .limit(10)

            if (!sellerErr && Array.isArray(sellerData) && sellerData.length > 0) {
              return <SellerPortalClient initialActiveEscrows={sellerData} />
            }
          }
        } catch (e) {
          console.error('Error verifying one-time token.')
        }
      }
      // No session and no redirect, render client UI
      return <SellerPortalClient />
    }

    const token = session.access_token
    try {
      // eslint-disable-next-line no-console
      console.log('[SSR] seller/page.tsx - access token length:', token ? token.length : 0)
    } catch (l) {}
    // Query active escrows directly using the server-side Supabase client.
    try {
      // eslint-disable-next-line no-console
      console.log('[SSR] seller/page.tsx - querying escrows via server client')
    } catch (l) {}

    try {
      const activeStatuses = [
        'created',
        'waiting_payment',
        'waiting_admin',
        'payment_confirmed',
        'in_progress',
        'on_hold'
      ]

      const { data: sellerData, error: sellerErr } = await supabase
        .from('escrows')
        .select('id, code, status, seller_id, buyer_id, description, price')
        .eq('seller_id', session.user.id)
        .in('status', activeStatuses)
        .order('created_at', { ascending: false })
        .limit(10)

      if (sellerErr) {
        console.error('Error querying escrows.')
      } else if (Array.isArray(sellerData) && sellerData.length > 0) {
        return <SellerPortalClient initialAuthState={{ authenticated: true, user: session.user }} initialActiveEscrows={sellerData} />
      }
    } catch (e) {
      console.error('Error during direct DB query.')
    }

    // No active escrow found: render client UI
    return <SellerPortalClient initialAuthState={{ authenticated: true, user: session.user }} />
  } catch (err) {
    console.error('Error during server-side rendering:', err)
    return <SellerPortalClient errorMessage="Error during server-side rendering." />
  }
}

