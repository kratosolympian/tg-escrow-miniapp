import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabaseServer'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceRoleClient()

    const { data, error } = await (supabase as any)
      .from('admin_settings')
      .select('*')
      .order('id', { ascending: true })

    if (error) {
      console.error('Error listing admin_settings:', error)
      return NextResponse.json({ error: 'Failed to list admin settings' }, { status: 500 })
    }

    return NextResponse.json({ rows: data })
  } catch (err) {
    console.error('Debug admin settings error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
