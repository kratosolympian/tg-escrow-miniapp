import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabaseServer'

export async function GET(request: NextRequest) {
  try {
    const serviceClient = createServiceRoleClient()

    // Try selecting is_online first; if the column doesn't exist (migration not applied), fall back
    const { data: admins, error } = await (serviceClient as any)
      .from('profiles')
      .select('id, full_name, email, telegram_id, is_online')
      .eq('role', 'admin')
      .eq('is_online', true)

    if (error) {
      // If the column doesn't exist (42703), fall back to returning all admins without is_online
      if (error?.code === '42703' || (error?.message && error.message.includes('does not exist'))) {
        const { data: allAdmins, error: allError } = await (serviceClient as any)
          .from('profiles')
          .select('id, full_name, email, telegram_id')
          .eq('role', 'admin')

        if (allError) {
          console.error('Error fetching admins fallback:', allError)
          return NextResponse.json({ admins: [] })
        }

        return NextResponse.json({ admins: (allAdmins || []).map((a: any) => ({ ...a, is_online: false })) })
      }

      console.error('Error fetching online admins:', error)
      return NextResponse.json({ error: 'Failed to fetch admins' }, { status: 500 })
    }

    return NextResponse.json({ admins: admins || [] })
  } catch (error) {
    console.error('Online admins error:', error)
    return NextResponse.json({ error: 'Failed to fetch admins' }, { status: 500 })
  }
}
