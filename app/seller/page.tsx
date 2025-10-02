import SellerPortalClient from '@/components/SellerPortalClient'
import { createServerClientWithCookies, createServiceRoleClient } from '@/lib/supabaseServer'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export const revalidate = 0

export default async function SellerPage({ searchParams }: { searchParams?: Record<string,string> }) {
  // Server-side: check for an authenticated session and query active escrows.
  try {
    const { createServerClientWithCookies } = await import('@/lib/supabaseServer')
    const supabase = createServerClientWithCookies()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      // Not authenticated on server; but if a one-time token is present in the URL,
      // pass it through to the my-active API so SSR can use it to identify the user.
      const oneTime = searchParams?.__one_time_token
      // Dev-only: check for a test_session cookie created by the test helpers.
      try {
        const cookieStore = cookies()
        const testSession = cookieStore.get('test_session')
        if (testSession && testSession.value) {
          // Query directly with service role and redirect if an active escrow exists
          try {
            const svcDev = createServiceRoleClient()
            const activeStatuses = ['created','waiting_payment','waiting_admin','payment_confirmed','in_progress','on_hold']
            const { data: sellerDataDev, error: sellerErrDev } = await svcDev
              .from('escrows')
              .select('id, code, status, seller_id, buyer_id')
              .eq('seller_id', testSession.value)
              .in('status', activeStatuses)
              .order('created_at', { ascending: false })
              .limit(10)

            if (!sellerErrDev && Array.isArray(sellerDataDev) && sellerDataDev.length > 0) {
              // Don't redirect - let client show the list
            }
          } catch (e) {
            // ignore dev helper errors
          }
        }
      } catch (e) {
        // ignore cookie errors
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
              .select('id, code, status, seller_id, buyer_id')
              .eq('seller_id', userId)
              .in('status', activeStatuses)
              .order('created_at', { ascending: false })
              .limit(10)

            if (!sellerErr && Array.isArray(sellerData) && sellerData.length > 0) {
              // Don't redirect - let client show the list
            } else if (sellerErr) {
              console.error('[SSR] seller/page.tsx - service-role query error for token path:', sellerErr)
            }
          }
        } catch (e) {
          console.error('[SSR] seller/page.tsx - one-time token verification path error', e)
        }
      }
      // No session and no redirect, render client UI
      return <SellerPortalClient />
    }

    // Query active escrows directly using the server-side Supabase client.
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
        .select('id, code, status, seller_id, buyer_id')
        .eq('seller_id', user.id)
        .in('status', activeStatuses)
        .order('created_at', { ascending: false })
        .limit(10)

      if (sellerErr) {
        console.error('[SSR] seller/page.tsx - error querying escrows:', sellerErr)
      } else if (Array.isArray(sellerData) && sellerData.length > 0) {
        // Don't redirect - let client show the list
      }
    } catch (e) {
      console.error('[SSR] seller/page.tsx - error during direct DB query', e)
    }

    // No active escrow found (or non-200 response): render client UI
    return <SellerPortalClient initialAuthState={{ authenticated: true, user: user }} />
  } catch (err) {
    // On error, fall back to client rendering to avoid breaking the page
    // eslint-disable-next-line no-console
    console.error('[SSR] seller/page.tsx - error during SSR check:', err)
    return <SellerPortalClient />
  }
}

