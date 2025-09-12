export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClientWithCookies } from '@/lib/supabaseServer'
import { requireRole } from '@/lib/rbac'
import { z } from 'zod'

const updateUserBankSchema = z.object({
  user_id: z.string().uuid().optional(),
  email: z.string().email().optional(),
  bank_name: z.string().min(1).max(100),
  account_number: z.string().min(6).max(20),
  account_holder: z.string().min(1).max(100)
})

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClientWithCookies()
    // only admins/super_admins may update other users' bank details
    const caller = await requireRole(supabase, 'admin')

    const body = await request.json()
    const parsed = updateUserBankSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const { user_id, email, bank_name, account_number, account_holder } = parsed.data

    // Resolve target user id
    let targetId: string | null = null
    if (user_id) targetId = user_id
    else if (email) {
      const { data: users, error } = await (supabase as any).auth.admin.listUsers()
      if (error) {
        console.error('Error listing users:', error)
        return NextResponse.json({ error: 'Failed to lookup user' }, { status: 500 })
      }
      const found = users.users.find((u: any) => u.email === email)
      if (!found) return NextResponse.json({ error: 'User not found' }, { status: 404 })
      targetId = found.id
    } else {
      return NextResponse.json({ error: 'user_id or email required' }, { status: 400 })
    }

    const { data, error } = await (supabase as any)
      .from('profiles')
      .update({ bank_name, account_number, account_holder_name: account_holder, updated_at: new Date().toISOString() })
      .eq('id', targetId)
      .select()
      .single()

    if (error) {
      console.error('Error updating user bank:', error)
      return NextResponse.json({ error: 'Failed to update user bank' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, profile: data })

  } catch (err) {
    console.error('Update user bank error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
