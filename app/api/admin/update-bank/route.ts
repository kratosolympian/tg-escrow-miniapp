export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClientWithCookies, createServiceRoleClient } from '@/lib/supabaseServer'
import { requireRole, requireAuth } from '@/lib/rbac'
import { z } from 'zod'

const updateBankSchema = z.object({
  bank_name: z.string().min(1).max(100),
  account_number: z.string().min(6).max(20),
  account_holder: z.string().min(1).max(100),
  // scope: 'platform' to update canonical admin_settings (super admin only),
  // or omitted to update the requesting admin's profile bank info
  scope: z.enum(['platform', 'profile']).optional()
})

export async function POST(request: NextRequest) {
  try {
  const supabase = createServerClientWithCookies()
    
  // Require authentication; we'll allow admins or super_admins
  const profile = await requireAuth(supabase)

  const body = await request.json()
  console.log('[update-bank] request body:', JSON.stringify(body))
  // server logging removed
    // Validate input with detailed errors
    const parsed = updateBankSchema.safeParse(body)
    if (!parsed.success) {
      console.error('[update-bank] Validation failed:', parsed.error.format())
      return NextResponse.json({ error: 'Invalid input data', details: parsed.error.format() }, { status: 400 })
    }
    const { bank_name, account_number, account_holder, scope } = parsed.data

    // If caller requested platform-level update, only super_admin may do this
    if (scope === 'platform') {
      console.log('[update-bank] platform update requested by profile id', profile.id, 'role=', profile.role)
      const roleStr = String(profile.role)
      if (roleStr !== 'super_admin') {
        console.error('[update-bank] Forbidden: only super_admin may update platform bank settings')
        return NextResponse.json({ error: 'Only super admin may update platform bank settings' }, { status: 403 })
      }

      // Use service role client for platform-level writes to bypass RLS and ensure persistence
  const service = createServiceRoleClient()
  const { data: updated, error } = await (service as any)
        .from('admin_settings')
        .upsert({
          id: 1,
          bank_name,
          account_number,
          account_holder,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' })
        .select()
        .single()

      if (error) {
        console.error('[update-bank] Error updating bank settings (service):', error)
        return NextResponse.json({ error: 'Failed to update bank settings' }, { status: 500 })
      }

      console.log('[update-bank] platform upsert result:', updated)

      return NextResponse.json({ ok: true, settings: updated }, { status: 200 })
    }

    // Otherwise, update the requesting admin's own profile banking info
    // Allow only admins or super_admins to update their profile bank details
    const roleStr2 = String(profile.role)
    if (!(roleStr2 === 'admin' || roleStr2 === 'super_admin')) {
      console.error('[update-bank] Forbidden: admin role required')
      return NextResponse.json({ error: 'admin role required' }, { status: 403 })
    }

    const { data: updatedProfile, error: updateError } = await (supabase as any)
      .from('profiles')
      .update({
        bank_name,
        account_number,
        account_holder_name: account_holder,
        updated_at: new Date().toISOString()
      })
      .eq('id', profile.id)
      .select()
      .single()

    if (updateError) {
      console.error('[update-bank] Error updating profile bank:', updateError)
      return NextResponse.json({ error: 'Failed to update profile bank details' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, profile: updatedProfile }, { status: 200 })

  } catch (error) {
    console.error('Update bank error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input data' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to update bank settings' }, { status: 500 })
  }
}
