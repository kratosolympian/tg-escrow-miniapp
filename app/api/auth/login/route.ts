export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClientWithCookies } from '@/lib/supabaseServer'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
})

export async function POST(request: NextRequest) {
  try {
    // Support both JSON (fetch) and form submissions (classic HTML form)
    const contentType = (request.headers.get('content-type') || '').toLowerCase()
    let email: string
    let password: string

    if (contentType.includes('application/json')) {
      const raw: unknown = await (request as any).json()
      const parsed = loginSchema.parse(raw)
      ;({ email, password } = parsed)
    } else {
      // form posts (application/x-www-form-urlencoded or multipart/form-data)
      const form = await request.formData()
      email = String(form.get('email') || '')
      password = String(form.get('password') || '')
      loginSchema.parse({ email, password })
    }

    // Create server client for authentication
    const supabase = createServerClientWithCookies()

    // Sign in the user
    const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (signInError) {
      console.error('Login error:', signInError)
      return NextResponse.json({ error: signInError.message }, { status: 401 })
    }

    if (!authData.user) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
    }

    // If the request was JSON (fetch from client), return a JSON payload so
    // client-side code can continue (e.g., auto-join after login). For classic
    // form posts, continue to redirect so Set-Cookie and navigation happen
    // together in the same response.
    if (contentType.includes('application/json')) {
      // Prefer to attach the Supabase session cookie explicitly to the JSON response
      // so fetch-based sign-ins receive the cookie. If the cookie isn't available
      // from the Supabase client, fall back to issuing a one-time token.
      try {
        // Supabase client with cookie adapter should have set cookies on the response
        // but in some environments they may not be forwarded; attempt to read from
        // the client's internal cookie store by calling getUser (which will also
        // refresh tokens if needed) and then create a response and set the
        // same cookie value ourselves.
        // Note: createServerClientWithCookies uses Next's cookie store internally;
        // we will attempt to read the session via getUser and, if present, set a
        // session cookie named 'sb:token' carrying the access token (short-lived).
        // This mirrors Supabase's cookie behavior enough for local flows.
        const { data: { user } } = await supabase.auth.getUser()
        if (user && authData.session && (authData.session as any).access_token) {
          // Create a signed one-time token as well so JSON clients always receive a token
          try {
            const { createSignedToken } = await import('@/lib/signedAuth')
            const token = createSignedToken(authData.user.id, 300)
            const resp = NextResponse.json({ user: authData.user, __one_time_token: token })
            // set short-lived cookies for access and refresh tokens so subsequent
            // server helpers can use them via centralized helper
            const { setAuthCookies } = await import('@/lib/cookies')
            setAuthCookies(resp, (authData.session as any).access_token, (authData.session as any).refresh_token)
            return resp
          } catch (e) {
            // If token creation fails for any reason, still return user and cookie
            const resp = NextResponse.json({ user: authData.user })
            const { setAuthCookies } = await import('@/lib/cookies')
            setAuthCookies(resp, (authData.session as any).access_token, (authData.session as any).refresh_token)
            return resp
          }
        }
      } catch (e) {
        console.warn('Could not attach session cookie to JSON login response:', e)
      }

      // If we couldn't attach a cookie, fall back to a one-time token for client flows
      // Always include a one-time token so fetch clients can continue even
      // if the cookie wasn't set on the response. This is safe for tests and
      // small client flows because the token is short-lived.
      try {
        const { createSignedToken } = await import('@/lib/signedAuth')
        const token = createSignedToken(authData.user.id, 300)
        const resp = NextResponse.json({ user: authData.user, __one_time_token: token })
        // Also attempt to set cookies if session info is available
        const { setAuthCookies } = await import('@/lib/cookies')
        setAuthCookies(resp, (authData.session as any)?.access_token, (authData.session as any)?.refresh_token)
        return resp
      } catch (e) {
        const resp = NextResponse.json({ user: authData.user })
        return resp
      }
    }

    // On non-JSON (form) requests, keep the redirect behavior. If a redirect_escrow cookie
    // exists and the user is a seller, redirect them to that escrow.
    const redirectCookie = request.cookies.get('redirect_escrow')?.value
    if (redirectCookie) {
      // determine user role
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (currentUser) {
        // fetch profile role
        const service = createServerClientWithCookies()
        const { data: profile } = await service
          .from('profiles')
          .select('role')
          .eq('id', currentUser.id)
          .single()
        if ((profile as any)?.role === 'seller') {
          const redirectUrl = new URL(`/seller/escrow/${redirectCookie}`, request.url)
          const resp = NextResponse.redirect(redirectUrl)
          // clear cookie
          const { clearRedirectCookie } = await import('@/lib/cookies')
          clearRedirectCookie(resp)
          return resp
        }
      }
    }

    const redirectUrl = new URL('/admin/dashboard', request.url)
    return NextResponse.redirect(redirectUrl)

  } catch (error) {
    console.error('Login route error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input data' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
