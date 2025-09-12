import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabaseServer'

export async function POST() {
  try {
    const supabase = createServiceRoleClient()
    
    if (process.env.DEBUG || process.env.NEXT_PUBLIC_DEBUG === '1') {
      console.log('Starting database migration to add super_admin role...')
    }
    
    // Step 1: Remove old constraint
    const { error: dropError } = await (supabase as any)
      .rpc('exec_sql', { 
        sql_query: 'ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;' 
      })
    
    if (dropError) {
      console.error('Error dropping old constraint:', dropError)
      // Continue anyway, constraint might not exist
    }
    
    // Step 2: Add new constraint with super_admin
    const { error: addError } = await (supabase as any)
      .rpc('exec_sql', { 
        sql_query: `ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
                    CHECK (role IN ('buyer', 'seller', 'admin', 'super_admin'));` 
      })
    
    if (addError) {
      console.error('Error adding new constraint:', addError)
      
      // Try alternative approach - direct SQL execution
      const { error: directError } = await (supabase as any)
        .from('profiles')
        .select('count(*)')
        .limit(1)
      
      if (directError) {
        return NextResponse.json({ 
          error: 'Failed to update database constraint',
          details: addError 
        }, { status: 500 })
      }
      
      // If we can access profiles, try updating the constraint manually
      // For now, let's try updating the user role directly
  const SUPER_ADMIN_EMAIL = 'ceo@kratos.ng'
      
      // Update role to super_admin (this will fail if constraint still exists)
      const { data: updatedProfile, error: updateError } = await (supabase as any)
        .from('profiles')
        .update({ role: 'super_admin' })
        .eq('email', SUPER_ADMIN_EMAIL)
        .select()
      
      if (updateError) {
        return NextResponse.json({ 
          error: 'Database constraint needs manual update',
          message: 'Please run this SQL in Supabase dashboard: ALTER TABLE profiles DROP CONSTRAINT profiles_role_check; ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN (\'buyer\', \'seller\', \'admin\', \'super_admin\'));',
          details: updateError
        }, { status: 500 })
      }
      
      return NextResponse.json({ 
        success: true,
        message: 'Super admin role assigned successfully (constraint bypassed)',
        profile: updatedProfile 
      })
    }
    
    // Step 3: Now update the user to super_admin
  const SUPER_ADMIN_EMAIL = 'ceo@kratos.ng'
    
    const { data: updatedProfile, error: updateError } = await (supabase as any)
      .from('profiles')
      .update({ role: 'super_admin' })
      .eq('email', SUPER_ADMIN_EMAIL)
      .select()
      .single()
    
    if (updateError) {
      console.error('Error updating user to super admin:', updateError)
      return NextResponse.json({ 
        error: 'Failed to assign super admin role',
        details: updateError 
      }, { status: 500 })
    }
    
    return NextResponse.json({ 
      success: true,
      message: 'Database migrated and super admin role assigned successfully',
      profile: updatedProfile 
    })

  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json({ 
      error: 'Migration failed',
      details: error 
    }, { status: 500 })
  }
}
