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

    // Sign up the user
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name
        }
      }
    })

    if (signUpError) {
      console.error('Signup error:', signUpError)
      return NextResponse.json({ error: signUpError.message }, { status: 400 })
    }

    if (!authData.user) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 400 })
    }

    // Attempt to sign the user in immediately so a session cookie is established
    try {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        console.warn('Sign-in after signup failed:', signInError)
        // continue — signup succeeded but no session was created
      } else {
        // signInData may contain session info; cookies are set via the server client
        console.log('User signed in after signup:', signInData?.user?.id)
      }
    } catch (e) {
      console.warn('Error signing in after signup:', e)
    }

    // Create profile using service client
    const { error: profileError } = await (serviceClient as any)
      .from('profiles')
      .insert({
        id: authData.user.id,
        email: email,
        full_name: name,
        role: 'seller',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })

    if (profileError) {
      console.error('Profile creation error:', profileError)
      // Continue anyway, profile might be created by trigger
    }

    // Generate a one-time token clients can use immediately to authenticate a follow-up action
    try {
      const { createSignedToken } = await import('@/lib/signedAuth')
      const token = createSignedToken(authData.user.id, 300) // 5 minutes
      return NextResponse.json({ 
        user: {
          id: authData.user.id,
          email: authData.user.email
        },
        __one_time_token: token
      })
    } catch (e) {
      return NextResponse.json({ 
        user: {
          id: authData.user.id,
          email: authData.user.email
        }
      })
    }

  } catch (error) {
    console.error('Signup route error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input data' }, { status: 400 })
    }
    // Return the error message for easier local debugging. Do not expose
    // sensitive details in production.
    const msg = (error && (error as any).message) ? (error as any).message : 'Internal server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
