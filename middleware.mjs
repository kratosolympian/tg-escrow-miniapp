import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  // Create a Supabase client configured to use cookies
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          response.cookies.set(name, value, options)
        },
        remove(name: string, options: any) {
          response.cookies.set(name, '', { ...options, maxAge: 0 })
        },
      },
    }
  )
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
      !request.nextUrl.pathname.startsWith('/admin/test')) {
    // Check if user is admin
    const serviceClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            response.cookies.set(name, value, options)
          },
          remove(name: string, options: any) {
            response.cookies.set(name, '', { ...options, maxAge: 0 })
          },
        },
      }
    )
    const { data: profile } = await (serviceClient as any)
      .from('profiles')
      .select('role')
      .eq('id', session?.user?.id)
      .single()
      console.log('Profile:', profile)
      console.log('Profile Error:', profileError)
      if (!profile || profile.role !== 'admin') {
        console.log('Access denied: Not an admin')
    if (!profile || profile.role !== 'admin') {
      return NextResponse.redirect(new URL('/admin/login', request.url))
      console.log('Access granted: Admin')
    }
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
