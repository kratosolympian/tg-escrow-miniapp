import { NextRequest, NextResponse } from 'next/server'
import { createServerClientWithCookies, createServiceRoleClient } from '@/lib/supabaseServer'
import { verifyTelegramInitData, deriveEmailAndPassword } from '@/lib/telegram'
import { z } from 'zod'

const requestSchema = z.object({
  initData: z.string().min(1)
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { initData } = requestSchema.parse(body)

    // Verify Telegram init data
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (!botToken) {
      return NextResponse.json({ error: 'Telegram bot not configured' }, { status: 500 })
    }

    const telegramUser = verifyTelegramInitData(initData, botToken)
    if (!telegramUser) {
      return NextResponse.json({ error: 'Invalid Telegram data' }, { status: 401 })
    }

    // Create service role client for admin operations
    const serviceClient = createServiceRoleClient()
    
    // Derive email and password from Telegram ID
    const { email, password } = deriveEmailAndPassword(telegramUser.id.toString())

    // Check if user exists, if not create them
    const { data: existingUser, error: signInError } = await serviceClient.auth.signInWithPassword({
      email,
      password
    })

    if (signInError) {
      // User doesn't exist, create them
      const { data: newUser, error: createError } = await serviceClient.auth.admin.createUser({
        email,
        password,
        user_metadata: {
          telegram_id: telegramUser.id,
          first_name: telegramUser.first_name,
          username: telegramUser.username
        }
      })

      if (createError || !newUser.user) {
        console.error('Error creating user:', createError)
        return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
      }

      // Create profile
      const { error: profileError } = await (serviceClient as any)
        .from('profiles')
        .insert({
          id: newUser.user.id,
          telegram_id: telegramUser.id.toString(),
          role: 'buyer'
        })

      if (profileError) {
        console.error('Error creating profile:', profileError)
        return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 })
      }
    } else if (existingUser.user) {
      // Update profile with telegram_id if not set
      await (serviceClient as any)
        .from('profiles')
        .upsert({
          id: existingUser.user.id,
          telegram_id: telegramUser.id.toString(),
        }, {
          onConflict: 'id'
        })
    }

    // Now create a server client with cookies to sign in the user
    const supabase = createServerClientWithCookies()
    const { error: clientSignInError } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (clientSignInError) {
      console.error('Error signing in user:', clientSignInError)
      return NextResponse.json({ error: 'Failed to sign in' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })

  } catch (error) {
    console.error('Telegram auth error:', error)
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 })
  }
}
