import SellerPortalClient from '@/components/SellerPortalClient'
import { createServerClientWithCookies, createServiceRoleClient } from '@/lib/supabaseServer'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export const revalidate = 0

console.log('[SSR] seller/page.tsx - file loaded')

export default async function SellerPage({ searchParams }: { searchParams?: Record<string,string> }) {
  console.log('[SSR] seller/page.tsx - function called')
  // Server-side: check for an authenticated session and query active escrows.
  try {
    console.log('[SSR] seller/page.tsx - in try block')
    const { createServerClientWithCookies } = await import('@/lib/supabaseServer')
    const supabase = createServerClientWithCookies()
    const { data } = await supabase.auth.getSession()
    const session = data?.session

    console.log('[SSR] seller/page.tsx - session present:', !!session)
    console.log('[SSR] seller/page.tsx - session user id:', session?.user?.id)
    console.log('[SSR] seller/page.tsx - session access_token length:', session?.access_token?.length || 0)

    if (!session) {
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

            // Debug logging: show what the service-role query returned
            try {
              // eslint-disable-next-line no-console
              console.log('[SSR][DEV] sellerDataDev length=', Array.isArray(sellerDataDev) ? sellerDataDev.length : 'null', 'err=', sellerErrDev)
              if (Array.isArray(sellerDataDev) && sellerDataDev.length > 0) {
                // eslint-disable-next-line no-console
                console.log('[SSR][DEV] sellerDataDev[0]=', JSON.stringify(sellerDataDev[0]))
              }
            } catch (logE) {}

            if (!sellerErrDev && Array.isArray(sellerDataDev) && sellerDataDev.length > 0) {
              const escrowId = sellerDataDev[0].id || (sellerDataDev[0] as any).escrow_id
              if (escrowId) redirect(`/seller/escrow/${escrowId}`)
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
          // eslint-disable-next-line no-console
          console.log('[SSR] seller/page.tsx - one-time-token verify userId:', userId)
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

            // Debug logging for token-based path
            try {
              // eslint-disable-next-line no-console
              console.log('[SSR][TOKEN] sellerData length=', Array.isArray(sellerData) ? sellerData.length : 'null', 'err=', sellerErr)
              if (Array.isArray(sellerData) && sellerData.length > 0) {
                // eslint-disable-next-line no-console
                console.log('[SSR][TOKEN] sellerData[0]=', JSON.stringify(sellerData[0]))
              }
            } catch (logE) {}

            if (!sellerErr && Array.isArray(sellerData) && sellerData.length > 0) {
              const escrowId = sellerData[0].id || (sellerData[0] as any).escrow_id
              if (escrowId) redirect(`/seller/escrow/${escrowId}`)
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
        .select('id, code, status, seller_id, buyer_id')
        .eq('seller_id', session.user.id)
        .in('status', activeStatuses)
        .order('created_at', { ascending: false })
        .limit(10)

      if (sellerErr) {
        console.error('[SSR] seller/page.tsx - error querying escrows:', sellerErr)
      } else if (Array.isArray(sellerData) && sellerData.length > 0) {
        try {
          // eslint-disable-next-line no-console
          console.log('[SSR] seller/page.tsx - found active seller escrows count=', sellerData.length)
        } catch (l) {}
        const escrowId = sellerData[0].id || (sellerData[0] as any).escrow_id
        if (escrowId) redirect(`/seller/escrow/${escrowId}`)
      }
    } catch (e) {
      console.error('[SSR] seller/page.tsx - error during direct DB query', e)
    }

    // No active escrow found (or non-200 response): render client UI
    return <SellerPortalClient initialAuthState={{ authenticated: true, user: session.user }} />
  } catch (err) {
    // On error, fall back to client rendering to avoid breaking the page
    // eslint-disable-next-line no-console
    console.error('[SSR] seller/page.tsx - error during SSR check:', err)
    return <SellerPortalClient />
  }
}

