export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServerClientWithCookies } from '@/lib/supabaseServer'

export async function GET(request: NextRequest) {
  try {
  const supabase = createServerClientWithCookies()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('Profile fetch error:', profileError)
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
    }

    // Normalize profile to an object before spreading to satisfy TypeScript
    const profileData = (profile && typeof profile === 'object' && !Array.isArray(profile)) ? profile : {}
    // Normalize presence flag: backend column is `is_online`, UI expects `online`
    const normalized = { ...profileData, online: (profileData as any).is_online ?? false }
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        ...normalized
      }
    })

  } catch (error) {
    console.error('Get current user error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
