import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServerClientWithCookies, createServiceRoleClient } from './lib/supabaseServer'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  // Create a Supabase client configured to use Next's cookie adapter
  const supabase = createServerClientWithCookies()
  // Minimal debug logging (avoid printing tokens)
  const url = request.nextUrl.pathname
  if (process.env.DEBUG) {
    // Log HTTP method and a harmless cookie count (do not print cookie values)
    const cookieHeader = request.headers.get('cookie')
    const cookieCount = cookieHeader ? cookieHeader.split(';').filter(Boolean).length : 0
    console.log('Middleware request:', request.method, url, 'cookies=', cookieCount)
  }

  // Prefer calling getUser which authenticates the session with Supabase Auth
  // rather than trusting session data read directly from cookies.
  let verifiedUser: any = null
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

  const userId = verifiedUser?.id ?? null

  // If no verified user, redirect to login for protected admin routes
  if (!verifiedUser && request.nextUrl.pathname.startsWith('/admin') &&
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
