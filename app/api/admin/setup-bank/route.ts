import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabaseServer'

// Temporary setup endpoint for development
export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceRoleClient()
    
    // First, ensure admin user profile exists
  const adminEmail = 'ceo@kratos.ng'
    
    // Get the user by email
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers()
    if (authError) {
      console.error('Error fetching users:', authError)
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
    }
    
    const adminUser = authData.users.find(user => user.email === adminEmail)
    if (!adminUser) {
      return NextResponse.json({ error: 'Admin user not found in auth' }, { status: 404 })
    }
    
    // Create or update admin profile
    const { error: profileError } = await (supabase as any)
      .from('profiles')
      .upsert({
        id: adminUser.id,
        email: adminUser.email,
        full_name: 'System Administrator',
        role: 'admin'
      })
    
    if (profileError) {
      console.error('Error creating admin profile:', profileError)
      return NextResponse.json({ error: 'Failed to create admin profile' }, { status: 500 })
    }

    // Create storage buckets if they don't exist
    const buckets = [
      { id: 'product-images', name: 'product-images', public: false },
      { id: 'receipts', name: 'receipts', public: false }
    ]
    
    for (const bucket of buckets) {
      const { error: bucketError } = await supabase.storage.createBucket(bucket.id, {
        public: bucket.public,
        fileSizeLimit: 10 * 1024 * 1024 // 10MB
      })
      
      // Ignore error if bucket already exists
      if (bucketError && !bucketError.message.includes('already exists')) {
        console.error(`Error creating bucket ${bucket.id}:`, bucketError)
      }
    }

    // Insert default bank settings for testing
    const { data, error } = await (supabase as any)
      .from('admin_settings')
      .upsert({
        bank_name: 'First Bank of Nigeria',
        account_number: '1234567890',
        account_holder: 'ESCROW SERVICES LTD',
        updated_at: new Date().toISOString()
      })
      .select()

    if (error) {
      console.error('Error creating bank settings:', error)
      return NextResponse.json({ error: 'Failed to create bank settings' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Admin profile and bank settings configured successfully',
      data 
    })

  } catch (error) {
    console.error('Setup bank error:', error)
    return NextResponse.json({ error: 'Failed to setup bank settings' }, { status: 500 })
  }
}
