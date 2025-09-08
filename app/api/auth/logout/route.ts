import { NextRequest, NextResponse } from 'next/server'
import { createServerClientWithCookies } from '@/lib/supabaseServer'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClientWithCookies()
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('Error signing out:', error)
      return NextResponse.json({ error: 'Failed to sign out' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 })
  }
}
