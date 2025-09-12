export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClientWithCookies } from '@/lib/supabaseServer'
import { requireAuth } from '@/lib/rbac'
import { z } from 'zod'

const presenceSchema = z.object({ is_online: z.boolean() })

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClientWithCookies()
    const profile = await requireAuth(supabase)

    const body = await request.json()
    const parsed = presenceSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const { is_online } = parsed.data

    const { data, error } = await (supabase as any)
      .from('profiles')
      .update({ is_online })
      .eq('id', profile.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating presence:', error)
      return NextResponse.json({ error: 'Failed to update presence' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, profile: data })
  } catch (err) {
    console.error('Set presence error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
