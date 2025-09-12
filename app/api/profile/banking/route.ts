import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServerClientWithCookies } from '@/lib/supabaseServer'

export async function POST(request: NextRequest) {
  try {
  const supabase = createServerClientWithCookies() as any

    // Get current user (authenticated against Supabase Auth server)
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      full_name,
      phone_number,
      bank_name,
      account_number,
      account_holder_name
    } = body

    // Validate required fields (BVN removed)
    if (!full_name || !phone_number || !bank_name || !account_number || !account_holder_name) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    // Validate account number format (10 digits for Nigerian banks)
    if (!/^\d{10}$/.test(account_number)) {
      return NextResponse.json({ error: 'Account number must be exactly 10 digits' }, { status: 400 })
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
        profile_completed: true,
        updated_at: new Date().toISOString()
      } as any)
      .eq('id', user.id)
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
  const supabase = createServerClientWithCookies()

    // Get current user (authenticated against Supabase Auth server)
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
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
