import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          },
        },
      }
    )

    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      full_name,
      phone_number,
      bank_name,
      account_number,
      account_holder_name,
      bvn
    } = body

    // Validate required fields
    if (!full_name || !phone_number || !bank_name || !account_number || !account_holder_name || !bvn) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    // Validate account number format (10 digits for Nigerian banks)
    if (!/^\d{10}$/.test(account_number)) {
      return NextResponse.json({ error: 'Account number must be exactly 10 digits' }, { status: 400 })
    }

    // Validate BVN format (11 digits)
    if (!/^\d{11}$/.test(bvn)) {
      return NextResponse.json({ error: 'BVN must be exactly 11 digits' }, { status: 400 })
    }

    // Validate phone number (Nigerian format)
    if (!/^(\+234|234|0)[789]\d{9}$/.test(phone_number)) {
      return NextResponse.json({ error: 'Please enter a valid Nigerian phone number' }, { status: 400 })
    }

    // Update profile with banking information
    const { data, error } = await supabase
      .from('profiles')
      .update({
        full_name,
        phone_number,
        bank_name,
        account_number,
        account_holder_name,
        bvn,
        profile_completed: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', session.user.id)
      .select()
      .single()

    if (error) {
      console.error('Profile update error:', error)
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Profile updated successfully',
      profile: data 
    })

  } catch (error) {
    console.error('Profile completion error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Get current profile information
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          },
        },
      }
    )

    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()

    if (error) {
      console.error('Profile fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
    }

    return NextResponse.json({ profile })

  } catch (error) {
    console.error('Profile fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
