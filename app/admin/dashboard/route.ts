import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  // When a browser or intermediate preserves a POST when following a login
  // redirect, force the client to perform a GET by responding with a 303 See Other.
  if (process.env.DEBUG) {
    console.log('admin/dashboard route: received POST, returning 303 to force GET')
  }
  const redirectUrl = new URL('/admin/dashboard', request.url)
  return NextResponse.redirect(redirectUrl, 303)
}
