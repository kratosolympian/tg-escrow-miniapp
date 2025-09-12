export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClientWithCookies, createServiceRoleClient } from '@/lib/supabaseServer'

export async function GET(request: NextRequest) {
  try {
    // Use service role client for admin operations
    const supabase = createServiceRoleClient()
    
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const q = searchParams.get('q')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = (supabase as any)
      .from('escrows')
      .select(`
        *,
        seller:profiles!seller_id(telegram_id),
        buyer:profiles!buyer_id(telegram_id),
        receipts(id, created_at)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Filter by status if provided
    if (status) {
      query = query.eq('status', status)
    }

    // Search in description if query provided
    if (q) {
      query = query.ilike('description', `%${q}%`)
    }

    const { data: escrows, error } = await query

    if (error) {
      console.error('Error fetching escrows:', error)
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
    }

    // Get total count for pagination
    let countQuery = (supabase as any)
      .from('escrows')
      .select('*', { count: 'exact', head: true })

    if (status) {
      countQuery = countQuery.eq('status', status)
    }
    if (q) {
      countQuery = countQuery.ilike('description', `%${q}%`)
    }

    const { count, error: countError } = await countQuery

    if (countError) {
      console.error('Error counting escrows:', countError)
    }

    return NextResponse.json({
      escrows,
      total: count || 0,
      limit,
      offset
    })

  } catch (error) {
    console.error('Admin escrows error:', error)
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  // Create Supabase service role client
  const supabase = createServiceRoleClient()
  const { data: { session } } = await supabase.auth.getSession()
  const userEmail = session?.user?.email

  // Only super admin can add/remove admins
  if (userEmail !== 'ceo@kratos.ng') {
    return NextResponse.json({ error: 'Forbidden: Only super admin can manage admins.' }, { status: 403 })
  }

  // ...existing code for admin management (add/remove)...
}
