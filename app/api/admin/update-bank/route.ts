import { NextRequest, NextResponse } from 'next/server'
import { createServerClientWithCookies } from '@/lib/supabaseServer'
import { requireRole } from '@/lib/rbac'
import { z } from 'zod'

const updateBankSchema = z.object({
  bank_name: z.string().min(1).max(100),
  account_number: z.string().min(10).max(20),
  account_holder: z.string().min(1).max(100)
})

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClientWithCookies()
    
    // Require admin role
    await requireRole(supabase, 'admin')
    
    const body = await request.json()
    const { bank_name, account_number, account_holder } = updateBankSchema.parse(body)

    // Insert new bank settings
    const { error } = await supabase
      .from('admin_settings')
      .insert({
        bank_name,
        account_number,
        account_holder
      })

    if (error) {
      console.error('Error updating bank settings:', error)
      return NextResponse.json({ error: 'Failed to update bank settings' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })

  } catch (error) {
    console.error('Update bank error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input data' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to update bank settings' }, { status: 500 })
  }
}
