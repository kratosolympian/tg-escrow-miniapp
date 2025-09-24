import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabaseServer'
import { createSignedToken } from '@/lib/signedAuth'

export async function GET(request: NextRequest) {
  try {
    const { createServerClientWithCookies } = await import('@/lib/supabaseServer')
    const supabase = createServerClientWithCookies()
    const { data } = await supabase.auth.getSession()
    const session = data?.session

    console.log('[TEST] session present:', !!session)
    console.log('[TEST] session user id:', session?.user?.id)
    console.log('[TEST] session access_token length:', session?.access_token?.length || 0)
    
    const supabaseSvc = createServiceRoleClient()
    const { searchParams } = new URL(request.url)
    const generateToken = searchParams.get('generateToken')

    if (generateToken) {
      const url = new URL(request.url)
      const role = url.searchParams.get('role') || 'seller'

      if (role === 'buyer') {
        // Get a buyer ID (allow active escrows for testing)
        const { data: profiles } = await supabaseSvc
          .from('profiles')
          .select('id')
          .eq('role', 'buyer')
          .limit(10)

        if (!profiles || profiles.length === 0) {
          return NextResponse.json({
            error: 'No buyers found'
          }, { status: 500 })
        }

        // Use the first available buyer
        const buyer = profiles[0]
        const token = createSignedToken(buyer.id, 3600) // 1 hour expiry
        return NextResponse.json({
          success: true,
          token,
          userId: buyer.id,
          role: 'buyer',
          message: 'Test token generated for buyer'
        })
      } else {
        // Get a seller ID that doesn't have active escrows
        const { data: escrows } = await supabase
          .from('escrows')
          .select('seller_id, status')
          .in('status', ['created', 'waiting_payment', 'waiting_admin', 'payment_confirmed', 'in_progress', 'on_hold'])

        // Get all seller IDs with active escrows
        const activeSellerIds = new Set(escrows?.map(e => e.seller_id) || [])

        // Find a seller who doesn't have active escrows
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('role', 'seller')
          .limit(10)

        const availableSeller = profiles?.find(p => !activeSellerIds.has(p.id))

        if (!availableSeller) {
          return NextResponse.json({
            error: 'No available sellers without active escrows found'
          }, { status: 500 })
        }

        const token = createSignedToken(availableSeller.id, 3600) // 1 hour expiry
        return NextResponse.json({
          success: true,
          token,
          userId: availableSeller.id,
          role: 'seller',
          message: 'Test token generated for available seller'
        })
      }
    }

    // Test database connection and check if tables exist
    const results: Record<string, any> = {}

    // Check profiles table
    try {
      const { count, error } = await supabaseSvc
        .from('profiles')
        .select('*', { count: 'exact', head: true })
      results.profiles = { exists: !error, count, error: error?.message }
    } catch (e) {
      results.profiles = { exists: false, error: e instanceof Error ? e.message : 'Unknown error' }
    }

    // Check escrows table
    try {
      const { count, error } = await supabaseSvc
        .from('escrows')
        .select('*', { count: 'exact', head: true })
      results.escrows = { exists: !error, count, error: error?.message }
    } catch (e) {
      results.escrows = { exists: false, error: e instanceof Error ? e.message : 'Unknown error' }
    }

    // Check one_time_tokens table
    try {
      const { count, error } = await supabaseSvc
        .from('one_time_tokens')
        .select('*', { count: 'exact', head: true })
      results.one_time_tokens = { exists: !error, count, error: error?.message }
    } catch (e) {
      results.one_time_tokens = { exists: false, error: e instanceof Error ? e.message : 'Unknown error' }
    }

    // Check admin_settings table
    try {
      const { data, error } = await supabaseSvc
        .from('admin_settings')
        .select('*')
      results.admin_settings = { exists: !error, data, error: error?.message }
    } catch (e) {
      results.admin_settings = { exists: false, error: e instanceof Error ? e.message : 'Unknown error' }
    }

    // Check some profiles for testing
    try {
      const roleFilter = searchParams.get('role')
      let query = supabaseSvc.from('profiles').select('email, role')
      
      if (roleFilter) {
        query = query.eq('role', roleFilter)
      }
      
      const { data, error } = await query.limit(50)
      results.sample_profiles = { exists: !error, data, error: error?.message }
    } catch (e) {
      results.sample_profiles = { exists: false, error: e instanceof Error ? e.message : 'Unknown error' }
    }

    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      tables: results
    })

  } catch (error) {
    console.error('Test endpoint error:', error)
    return NextResponse.json({
      error: 'Unexpected error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()
    const { verifyAndConsumeSignedToken } = await import('@/lib/signedAuth')
    const userId = await verifyAndConsumeSignedToken(token)
    return NextResponse.json({ userId, valid: !!userId })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}