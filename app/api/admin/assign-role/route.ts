import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabaseServer'

export async function POST(request: NextRequest) {
  if (request.method !== 'POST') {
    return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 })
  }
  try {
    const { email, action = 'add' } = await request.json()
    
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    if (!['add', 'remove'].includes(action)) {
      return NextResponse.json({ error: 'Action must be "add" or "remove"' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()
    
    // Check if the requester is a super admin
    // For API calls, we'll implement this check in the middleware or require authentication
    // For now, we'll allow the operation but track super admin vs regular admin
    
  const SUPER_ADMIN_EMAIL = 'ceo@kratos.ng'
    
    // Get the user by email from auth
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers()
    if (authError) {
      console.error('Error fetching users:', authError)
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
    }
    
    const targetUser = authData.users.find(user => user.email === email)
    if (!targetUser) {
      return NextResponse.json({ error: `User with email ${email} not found in auth` }, { status: 404 })
    }
    
  if (process.env.DEBUG) console.log(`${action === 'add' ? 'Adding admin to' : 'Removing admin from'} user id:`, targetUser.id)
    
    // Determine the role based on email and action
    let newRole: string
    if (action === 'remove') {
      // Map removal to a valid role value (buyer) to satisfy DB CHECK constraint
      newRole = 'buyer'
    } else {
      // If it's the super admin email, assign super_admin role
      newRole = email === SUPER_ADMIN_EMAIL ? 'super_admin' : 'admin'
    }
    
    // Prevent removal of super admin
    if (email === SUPER_ADMIN_EMAIL && action === 'remove') {
      return NextResponse.json({ 
        error: 'Cannot remove super admin privileges' 
      }, { status: 403 })
    }
    
    // First, check if profile exists
    const { data: existingProfile, error: checkError } = await (supabase as any)
      .from('profiles')
      .select('*')
      .eq('id', targetUser.id)
      .single()
    
    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking profile:', checkError)
      return NextResponse.json({ error: 'Failed to check profile' }, { status: 500 })
    }
    
    if (existingProfile) {
  if (process.env.DEBUG) console.log('Profile exists for user id:', targetUser.id, 'updating role')
      // Update existing profile role
      const { data: updatedProfile, error: updateError } = await (supabase as any)
        .from('profiles')
        .update({ role: newRole })
        .eq('id', targetUser.id)
        .select()
        .single()
      
      if (updateError) {
        console.error('Error updating profile role')
        return NextResponse.json({ error: 'Failed to update role', details: updateError?.message || 'Unknown' }, { status: 500 })
      }
      
      const message = newRole === 'super_admin' ? 'Super admin role assigned' :
                     newRole === 'admin' ? 'Admin role assigned' : 'Admin role removed'
      
      return NextResponse.json({ 
        success: true, 
        message: `${message} successfully`,
        profile: updatedProfile 
      })
    } else {
      if (action === 'remove') {
        return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
      }
      
  if (process.env.DEBUG) console.log('Profile does not exist for user id:', targetUser.id, 'creating new profile')
      // Create new profile with specified role
      const { data: newProfile, error: createError } = await (supabase as any)
        .from('profiles')
        .insert({
          id: targetUser.id,
          email: targetUser.email,
          full_name: targetUser.user_metadata?.full_name || '',
          role: newRole
        })
        .select()
        .single()
      
      if (createError) {
        console.error('Error creating profile')
        return NextResponse.json({ error: 'Failed to create profile', details: createError?.message || 'Unknown' }, { status: 500 })
      }
      
      const message = newRole === 'super_admin' ? 'Super admin profile created' :
                     'Admin profile created'
      
      return NextResponse.json({ 
        success: true, 
        message: `${message} successfully`,
        profile: newProfile 
      })
    }

  } catch (error) {
    console.error('Role management error:', error)
    return NextResponse.json({ error: 'Failed to manage role' }, { status: 500 })
  }
}

// GET method to list all admins
export async function GET() {
  try {
    const supabase = createServiceRoleClient()
    
    // Get all admin and super_admin profiles
    const { data: adminProfiles, error } = await (supabase as any)
      .from('profiles')
      .select('id, email, full_name, role, created_at, updated_at')
      .in('role', ['admin', 'super_admin'])
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error fetching admin profiles:', error)
      return NextResponse.json({ error: 'Failed to fetch admins' }, { status: 500 })
    }
    
    // Separate super admins from regular admins
    const superAdmins = adminProfiles.filter((profile: any) => profile.role === 'super_admin')
    const regularAdmins = adminProfiles.filter((profile: any) => profile.role === 'admin')
    
    return NextResponse.json({ 
      success: true,
      super_admins: superAdmins,
      admins: regularAdmins,
      total_count: adminProfiles.length,
      super_admin_count: superAdmins.length,
      admin_count: regularAdmins.length
    })

  } catch (error) {
    console.error('Admin list error:', error)
    return NextResponse.json({ error: 'Failed to list admins' }, { status: 500 })
  }
}
