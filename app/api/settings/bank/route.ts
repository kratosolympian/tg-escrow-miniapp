import { NextRequest, NextResponse } from 'next/server'
import { createServerClientWithCookies } from '@/lib/supabaseServer'
import { requireAuth } from '@/lib/rbac'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClientWithCookies()
    
    // Require authentication
    await requireAuth(supabase)
    
    // Get latest bank settings
    const { data: settings, error } = await supabase
      .from('admin_settings')
      .select('bank_name, account_number, account_holder, updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      console.error('Error fetching bank settings:', error)
      return NextResponse.json({ error: 'No bank settings configured' }, { status: 404 })
    }

    return NextResponse.json(settings)

  } catch (error) {
    console.error('Get bank settings error:', error)
    return NextResponse.json({ error: 'Failed to fetch bank settings' }, { status: 500 })
  }
}
