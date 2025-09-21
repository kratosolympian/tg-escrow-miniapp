import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { createServerClientWithCookies } from '@/lib/supabaseServer'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClientWithCookies()
    const { error } = await supabase.auth.signOut()

    // Clear cookies we set during login even if signOut has issues.
  const resp = NextResponse.json({ ok: true })
  const { clearAuthCookies, clearRedirectCookie } = await import('@/lib/cookies')
  clearAuthCookies(resp)
  clearRedirectCookie(resp)

    if (error) {
      console.error('Error signing out:', error)
      // Still return success after clearing cookies to avoid leaving clients in a signed-in state
      return resp
    }

    return resp
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 })
  }
}
