import { NextRequest, NextResponse } from 'next/server'
import { createServerClientWithCookies } from '@/lib/supabaseServer'
import { requireAuth, canAccessEscrow } from '@/lib/rbac'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClientWithCookies()
    const profile = await requireAuth(supabase)

    // Find escrow by ID with related data
    const { data: escrow, error: findError } = await (supabase as any)
      .from('escrows')
      .select(`
        *,
        seller:profiles!seller_id(telegram_id),
        buyer:profiles!buyer_id(telegram_id),
        receipts(id, file_path, created_at, uploaded_by),
        status_logs(id, status, created_at, changed_by, profiles!changed_by(telegram_id))
      `)
      .eq('id', params.id)
      .single()

    if (findError || !escrow) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Check access
    if (!canAccessEscrow(profile, escrow)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    return NextResponse.json(escrow)

  } catch (error) {
    console.error('Get escrow by ID error:', error)
    return NextResponse.json({ error: 'Failed to fetch transaction' }, { status: 500 })
  }
}
