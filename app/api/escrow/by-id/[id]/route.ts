import { NextRequest, NextResponse } from 'next/server'
import { createServerClientWithCookies, createServiceRoleClient } from '@/lib/supabaseServer'
import { ESCROW_STATUS } from '@/lib/status'

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
  const { data: escrow, error: findError } = await (serviceClient as any)
      .from('escrows')
      .select(`
        *,
        seller:profiles!seller_id(telegram_id, email, full_name, bank_name, account_number, account_holder_name, phone_number),
        buyer:profiles!buyer_id(telegram_id, email, full_name, bank_name, account_number, account_holder_name, phone_number)
      `)
      .eq('id', params.id)
      .single()

    if (findError || !escrow) {
      console.error('Escrow find error:', findError)
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    
    // If escrow has an expires_at and it's passed, expire it (only if waiting for payment)
    try {
      if ((escrow as any)?.expires_at) {
        const expiresAt = new Date((escrow as any).expires_at).getTime()
        const now = Date.now()
        if (now > expiresAt && (escrow as any).status === ESCROW_STATUS.WAITING_PAYMENT) {
          // mark as closed
          const { error: updateError } = await (serviceClient as any)
            .from('escrows')
            .update({ status: ESCROW_STATUS.CLOSED })
            .eq('id', params.id)

          if (!updateError) {
            // log status change
            await (serviceClient as any).from('status_logs').insert({
              escrow_id: params.id,
              status: ESCROW_STATUS.CLOSED,
              changed_by: null
            })
            ;(escrow as any).status = ESCROW_STATUS.CLOSED
          }
        }
      }
    } catch (e) {
      // non-fatal
      console.error('Error checking expiry:', e)
    }
    // Check access - user must be seller, buyer, or admin
    // Get user profile to check if admin
    const { data: userProfile } = await (serviceClient as any)
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

  const isAdmin = (userProfile as any)?.role === 'admin' || (userProfile as any)?.role === 'super_admin'
    const hasAccess = isAdmin || (escrow as any).seller_id === user.id || (escrow as any).buyer_id === user.id

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get receipts with more detailed info using service client
    const { data: receipts } = await serviceClient
      .from('receipts')
      .select(`
        id, 
        file_path as receipt_url, 
        filename,
        created_at as uploaded_at, 
        uploaded_by
      `)
      .eq('escrow_id', params.id)
      .order('created_at', { ascending: true })

    return NextResponse.json({
      success: true,
      escrow: {
        ...(escrow as any),
        receipts: receipts || []
      }
    })

  } catch (error) {
    console.error('Get escrow by ID error:', error)
    return NextResponse.json({ error: 'Failed to fetch transaction' }, { status: 500 })
  }
}
