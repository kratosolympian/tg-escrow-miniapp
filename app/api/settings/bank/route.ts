import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabaseServer'

export async function GET(request: NextRequest) {
  try {
    // Use service role client for public access to bank settings
    const supabase = createServiceRoleClient()
    
    // First try to read canonical settings row (id = 1)
    const { data: canonical, error: canonErr } = await (supabase as any)
      .from('admin_settings')
      .select('bank_name, account_number, account_holder, updated_at')
      .eq('id', 1)
      .single()

    if (!canonErr && canonical) {
      return NextResponse.json(canonical, { status: 200, headers: { 'Cache-Control': 'no-store' } })
    }

    // Fallback to latest row by updated_at
    const { data: settings, error } = await (supabase as any)
      .from('admin_settings')
      .select('bank_name, account_number, account_holder, updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      console.error('Error fetching bank settings:', error)
      return NextResponse.json({ error: 'No bank settings configured' }, { status: 404 })
    }

    return NextResponse.json(settings, { status: 200, headers: { 'Cache-Control': 'no-store' } })

  } catch (error) {
    console.error('Get bank settings error:', error)
    return NextResponse.json({ error: 'Failed to fetch bank settings' }, { status: 500 })
  }
}
