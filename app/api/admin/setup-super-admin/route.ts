import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabaseServer'

export async function POST() {
  try {
    const supabase = createServiceRoleClient()
    
  const SUPER_ADMIN_EMAIL = 'ceo@kratos.ng'
    
    // Direct update to super_admin role
    const { data: updatedProfile, error: updateError } = await (supabase as any)
      .from('profiles')
      .update({ role: 'super_admin' })
      .eq('email', SUPER_ADMIN_EMAIL)
      .select()
      .single()
    
    if (updateError) {
      console.error('Error updating to super admin:', updateError)
      return NextResponse.json({ error: 'Failed to update to super admin', details: updateError }, { status: 500 })
    }
    
    return NextResponse.json({ 
      success: true,
      message: 'Super admin role assigned successfully',
      profile: updatedProfile 
    })

  } catch (error) {
    console.error('Super admin setup error:', error)
    return NextResponse.json({ error: 'Failed to setup super admin' }, { status: 500 })
  }
}
