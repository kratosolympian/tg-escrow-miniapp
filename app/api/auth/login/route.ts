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

    // On success, issue a redirect so the Set-Cookie (HTTP-only) and navigation
    // happen in the same response. This avoids fetch + client-side navigation
    // races where the cookie may not be present on the next server-side request.
    // If a redirect_escrow cookie exists and the user is a seller, redirect them to that escrow.
    const redirectCookie = request.cookies.get('redirect_escrow')?.value
    if (redirectCookie) {
      // determine user role
      const supabase = createServerClientWithCookies()
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
          resp.cookies.set('redirect_escrow', '', { path: '/', httpOnly: true, sameSite: 'lax', expires: new Date(0) })
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
