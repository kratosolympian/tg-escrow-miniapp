import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServerClientWithCookies, createServiceRoleClient } from './lib/supabaseServer'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  // Create a Supabase client configured to use Next's cookie adapter
  const supabase = createServerClientWithCookies()
    // Debug logging
    console.log('--- Middleware Debug ---')
    const url = request.nextUrl.pathname
    console.log('Request URL:', url)

  // Get session
  const { data: { session } } = await supabase.auth.getSession()
  const userEmail = session?.user?.email

    console.log('Session:', session)
    console.log('User Email:', userEmail)

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
      .eq('id', session?.user?.id)
      .single()
      
    console.log('Profile:', profile)
    console.log('Profile Error:', profileError)

    // Allow both regular admins and super admins
    const role = profile?.role
    if (profileError || !profile || (role !== 'admin' && role !== 'super_admin')) {
      console.log('Access denied: Not an admin or profile error')
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
    
    console.log('Access granted: Admin')
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
