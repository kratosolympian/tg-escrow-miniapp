import { NextRequest, NextResponse } from 'next/server'
import { createServerClientWithCookies, createServiceRoleClient } from '@/lib/supabaseServer'

export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const supabase = createServerClientWithCookies()
    const serviceClient = createServiceRoleClient()
    
    // Get user if authenticated (but don't require auth for public escrow view)
    const { data: { user } } = await supabase.auth.getUser()

    // Find escrow by code using service client to bypass RLS
    const { data: escrow, error: findError } = await serviceClient
      .from('escrows')
      .select('*')
      .eq('code', params.code.toUpperCase())
      .single()

    if (findError || !escrow) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // If user is not authenticated or not a member, return limited info
    if (!user || ((escrow as any).seller_id !== user.id && (escrow as any).buyer_id !== user.id)) {
      return NextResponse.json({
        id: (escrow as any).id,
        code: (escrow as any).code,
        description: (escrow as any).description,
        price: (escrow as any).price,
        admin_fee: (escrow as any).admin_fee,
        status: (escrow as any).status,
        created_at: (escrow as any).created_at,
        has_buyer: !!(escrow as any).buyer_id
      })
    }

    // Return full details for members - get related data
    const { data: statusLogs } = await serviceClient
      .from('status_logs')
      .select('id, status, created_at, changed_by')
      .eq('escrow_id', (escrow as any).id)
      .order('created_at', { ascending: true })

    const { data: receipts } = await serviceClient
      .from('receipts')
      .select('id, file_path, created_at, uploaded_by')
      .eq('escrow_id', (escrow as any).id)
      .order('created_at', { ascending: true })

    return NextResponse.json({
      ...(escrow as any),
      status_logs: statusLogs || [],
      receipts: receipts || []
    })

  } catch (error) {
    console.error('Get escrow by code error:', error)
    return NextResponse.json({ error: 'Failed to fetch transaction' }, { status: 500 })
  }
}
