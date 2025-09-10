import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabaseServer'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()
    
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }

    // Use service client for admin operations
    const serviceClient = createServiceRoleClient()
    
    // Find user by email
    const { data: users, error: userError } = await serviceClient.auth.admin.listUsers()
    
    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 400 })
    }

    const user = users.users.find(u => u.email === email)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Update user password
    const { data, error } = await serviceClient.auth.admin.updateUserById(
      user.id,
      {
        password: password,
        email_confirm: true
      }
    )

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ 
      success: true,
      message: 'Password updated successfully',
      user: {
        id: user.id,
        email: user.email
      }
    })

  } catch (error) {
    console.error('Password reset error:', error)
    return NextResponse.json({ error: 'Password reset failed' }, { status: 500 })
  }
}
