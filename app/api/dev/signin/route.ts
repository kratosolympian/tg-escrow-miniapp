import { NextResponse } from 'next/server'
import { createServerClientWithCookies, createServiceRoleClient } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const email = (body.email || '').toString()
    const password = (body.password || 'letmein').toString()
    if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 })
    const supabase = createServerClientWithCookies()

    // Try to find an app profile matching the email so we can return the
    // profile along with the auth user. This helps dev tooling/tests avoid
    // mismatches between an auth user and the profiles table.
    let profile: any = null
    try {
      const { data: p } = await supabase
        .from('profiles')
        .select('*')
        .ilike('email', email)
        .limit(1)
        .maybeSingle()
      profile = p || null
    } catch (e) {
      // ignore - non-fatal
      profile = null
    }

    // If a profile exists, try to sign in using the provided email (this is
    // the same behavior as before) — we'll return both auth user and profile
    // in the response so the client can make an informed decision. If the
    // signed-in auth user differs from the profile's id, upsert a new
    // profile row for the signed-in user copying key display fields (dev-only).
    let authData: any = null
    let signInError: any = null
    
    try {
      const result = await supabase.auth.signInWithPassword({ email, password })
      authData = result.data
      signInError = result.error
    } catch (e) {
      signInError = { message: 'Sign in failed' }
    }
    
    // If sign in failed, try to create the user (dev only)
    if (signInError && process.env.NODE_ENV !== 'production') {
      try {
        console.log('Dev signin: user not found, attempting to create user')
        const signUpResult = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: email.split('@')[0] // Use part before @ as name
            }
          }
        })
        
        if (signUpResult.data.user && !signUpResult.error) {
          authData = signUpResult.data
          signInError = null
          console.log('Dev signin: user created successfully')
        } else if (signUpResult.error?.message?.includes('already registered')) {
          // User exists but password might be wrong, try sign in again
          const retryResult = await supabase.auth.signInWithPassword({ email, password })
          authData = retryResult.data
          signInError = retryResult.error
        }
      } catch (e) {
        console.warn('Dev signin: failed to create user', e)
      }
    }
    
    if (signInError) return NextResponse.json({ error: signInError.message }, { status: 401 })
    if (!authData.user) return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
    // Ensure there is a profile row that matches the signed-in auth user id.
    // In dev, we force the role to 'buyer' for repro convenience so tests that
    // expect buyer flows will work consistently.
    try {
      const service = createServiceRoleClient()
      const copy: any = {
        id: authData.user.id,
        email: authData.user.email || email,
        full_name: authData.user.user_metadata?.full_name || null,
        role: 'buyer',
        profile_completed: false,
      }
      await service.from('profiles').upsert(copy, { onConflict: 'id' })

      // Refresh profile variable from the DB to return the canonical profile
      try {
        const { data: profileById } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authData.user.id)
          .maybeSingle()
        if (profileById) profile = profileById
      } catch (e) {
        // ignore
      }
    } catch (e) {
      console.warn('Dev signin: failed to ensure profile for signed-in user', e)
    }

    // Return both the auth user and the matched (or synthesized) profile
    return NextResponse.json({ user: authData.user, profile })
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
