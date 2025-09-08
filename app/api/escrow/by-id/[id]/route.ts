import { NextRequest, NextResponse } from 'next/server'
import { createServerClientWithCookies, createServiceRoleClient } from '@/lib/supabaseServer'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClientWithCookies()
    const serviceClient = createServiceRoleClient()
    
    // Get authenticated user directly to bypass profile lookup issue
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Find escrow by ID using service client to bypass RLS
    const { data: escrow, error: findError } = await serviceClient
      .from('escrows')
      .select(`
        *
      `)
      .eq('id', params.id)
      .single()

    if (findError || !escrow) {
      console.error('Escrow find error:', findError)
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Check access - user must be seller, buyer, or admin
    if ((escrow as any).seller_id !== user.id && (escrow as any).buyer_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get status logs using service client
    const { data: statusLogs } = await serviceClient
      .from('status_logs')
      .select('id, status, created_at, changed_by')
      .eq('escrow_id', params.id)
      .order('created_at', { ascending: true })

    // Get receipts using service client
    const { data: receipts } = await serviceClient
      .from('receipts')
      .select('id, file_path, created_at, uploaded_by')
      .eq('escrow_id', params.id)
      .order('created_at', { ascending: true })

    return NextResponse.json({
      ...(escrow as any),
      status_logs: statusLogs || [],
      receipts: receipts || []
    })

  } catch (error) {
    console.error('Get escrow by ID error:', error)
    return NextResponse.json({ error: 'Failed to fetch transaction' }, { status: 500 })
  }
}
