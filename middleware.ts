import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServerClientWithCookies, createServiceRoleClient } from './lib/supabaseServer'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  // Create a Supabase client configured to use Next's cookie adapter
  const supabase = createServerClientWithCookies()
  // Minimal debug logging (avoid printing tokens)
  const url = request.nextUrl.pathname
  if (process.env.DEBUG) console.log('Middleware request:', url)

  // Get session (do not log full session object)
  const { data: { session } } = await supabase.auth.getSession()
  const userId = session?.user?.id

  // If a session exists, verify it with a trusted call to getUser
  let verifiedUser: any = null
  if (session?.access_token) {
    try {
      const { data: userResult, error: userError } = await supabase.auth.getUser()
      if (userError) {
        if (process.env.DEBUG) console.log('Warning: supabase.auth.getUser() error in middleware', userError.message ?? userError)
      } else {
        verifiedUser = userResult?.user ?? null
      }
    } catch (err) {
      if (process.env.DEBUG) console.log('Warning: failed to verify user in middleware', err)
    }
  }

  // If no session, redirect to login for protected admin routes
  if (!session && request.nextUrl.pathname.startsWith('/admin') &&
      !request.nextUrl.pathname.startsWith('/admin/login') &&
      !request.nextUrl.pathname.startsWith('/admin/test')) {
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }
  // Protect all /admin routes except login and test
  if (request.nextUrl.pathname.startsWith('/admin') &&
      !request.nextUrl.pathname.startsWith('/admin/login') &&
      !request.nextUrl.pathname.startsWith('/admin/test') &&
      !request.nextUrl.pathname.startsWith('/admin/init-admin') &&
      !request.nextUrl.pathname.startsWith('/admin/check-access')) {
    // Check if user is admin
  const serviceClient = createServiceRoleClient()
    const { data: profile, error: profileError } = await (serviceClient as any)
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()

    // Allow both regular admins and super admins
    const role = profile?.role
    if (profileError || !profile || (role !== 'admin' && role !== 'super_admin')) {
      if (process.env.DEBUG) console.log('Access denied: admin check failed for userId present=', !!userId)
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
    
    if (process.env.DEBUG) console.log('Access granted: Admin for userId present=', !!userId)
    return response
  }
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
