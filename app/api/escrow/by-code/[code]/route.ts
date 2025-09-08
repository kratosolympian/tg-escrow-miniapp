import { NextRequest, NextResponse } from 'next/server'
import { createServerClientWithCookies } from '@/lib/supabaseServer'
import { getProfile, canAccessEscrow } from '@/lib/rbac'

export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const supabase = createServerClientWithCookies()
    const profile = await getProfile(supabase)

    // Find escrow by code
    const { data: escrow, error: findError } = await (supabase as any)
      .from('escrows')
      .select(`
        *,
        seller:profiles!seller_id(telegram_id),
        buyer:profiles!buyer_id(telegram_id)
      `)
      .eq('code', params.code.toUpperCase())
      .single()

    if (findError || !escrow) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // If user is not authenticated or not a member, return limited info
    if (!profile || !canAccessEscrow(profile, escrow)) {
      return NextResponse.json({
        id: escrow.id,
        code: escrow.code,
        description: escrow.description,
        price: escrow.price,
        admin_fee: escrow.admin_fee,
        status: escrow.status,
        created_at: escrow.created_at,
        has_buyer: !!escrow.buyer_id
      })
    }

    // Return full details for members
    return NextResponse.json(escrow)

  } catch (error) {
    console.error('Get escrow by code error:', error)
    return NextResponse.json({ error: 'Failed to fetch transaction' }, { status: 500 })
  }
}
