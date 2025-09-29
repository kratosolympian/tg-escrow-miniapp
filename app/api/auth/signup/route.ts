import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { createServerClientWithCookies, createServiceRoleClient } from '@/lib/supabaseServer'
import { z } from 'zod'

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1).max(100)
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, name } = signupSchema.parse(body)

    // Create server client for user registration
    const supabase = createServerClientWithCookies()
    const serviceClient = createServiceRoleClient()

    // Sign up the user using the server cookie client first. In some
    // environments (RLS / trigger setup) this can fail with a DB error
    // during the auth.user creation. If that happens, fall back to the
    // service-role admin API which has privileges to create the auth user
    // and associated profile rows.
    let authData: any = null
    try {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) throw error
      authData = data
    } catch (err: any) {
      // Attempt fallback with service role admin.createUser
      console.warn('Signup via server-client failed, will fallback to service role if allowed:', err)
      try {
        const { data: created, error: adminErr } = await serviceClient.auth.admin.createUser({
          email,
          password,
          user_metadata: { full_name: name }
        } as any)
        if (adminErr) {
          console.error('Service-role createUser failed:', adminErr)
          return NextResponse.json({ error: adminErr.message || 'Failed to create user' }, { status: 500 })
        }
        authData = { user: created.user }
        // Ensure profile exists (service role can write profiles directly)
        const userId = created.user?.id
        if (userId) {
          try {
            await serviceClient.from('profiles').insert({ id: userId, email, full_name: name, role: 'seller' }).select()
          } catch (e) {
            // non-fatal; log but continue
            console.warn('Failed to create profile via service role after admin.createUser:', e)
          }
        }
      } catch (e2) {
        console.error('Fallback service-role signup failed:', e2)
        return NextResponse.json({ error: (e2 && (e2 as any).message) || 'Signup failed' }, { status: 500 })
      }
    }

    if (!authData?.user) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 400 })
    }

    // Attempt to sign the user in immediately so a session cookie is established
    let signInData: any = null
    try {
      const signed = await supabase.auth.signInWithPassword({ email, password })
      signInData = signed.data
      const signInError = signed.error
      if (signInError) {
        console.warn('Sign-in after signup failed:', signInError)
        // continue — signup succeeded but no session was created
      } else {
        // signInData may contain session info; cookies are set via the server client
        if (process.env.DEBUG) console.log('User signed in after signup, id:', signInData?.user?.id)
      }
    } catch (e) {
      console.warn('Error signing in after signup:', e)
    }

    // Profile will be created automatically by database trigger
    // Generate a one-time token clients can use immediately to authenticate a follow-up action
    try {
      const { createSignedTokenAndPersist } = await import('@/lib/signedAuth')
      const token = await createSignedTokenAndPersist(authData.user.id, 300) // 5 minutes
      if (process.env.NEXT_PUBLIC_DEBUG) console.log('Signup route: created one-time token for user', authData.user.id)
      // Build response and, when possible, attach auth cookies so JSON clients receive httpOnly cookies
      const resp = NextResponse.json({
        user: {
          id: authData.user.id,
          email: authData.user.email
        },
        __one_time_token: token
      })
      try {
        const { setAuthCookies } = await import('@/lib/cookies')
        // Prefer session from signInData if available, otherwise check authData.session
        const session = signInData?.session || (authData as any).session
        if (session && session.access_token) {
          setAuthCookies(resp, session.access_token, session.refresh_token)
        }
      } catch (e) {
        // ignore cookie attach failures
      }
      return resp
    } catch (e) {
      if (process.env.NEXT_PUBLIC_DEBUG) console.log('Signup route: created user but failed to create one-time token, user id=', authData.user.id)
      const resp = NextResponse.json({
        user: {
          id: authData.user.id,
          email: authData.user.email
        }
      })
      try {
        const { setAuthCookies } = await import('@/lib/cookies')
        const session = signInData?.session || (authData as any).session
        if (session && session.access_token) {
          setAuthCookies(resp, session.access_token, session.refresh_token)
        }
      } catch (e) {}
      return resp
    }

  } catch (error) {
  console.error('Signup route error')
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input data' }, { status: 400 })
    }
    // Return the error message for easier local debugging. Do not expose
    // sensitive details in production.
    const msg = (error && (error as any).message) ? (error as any).message : 'Internal server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
