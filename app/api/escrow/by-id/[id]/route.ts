export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClientWithCookies, createServiceRoleClient } from '@/lib/supabaseServer'
import { ESCROW_STATUS } from '@/lib/status'

// Helper to check if string is UUID
function isUUID(str: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str)
}

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



    let escrow = null
    let findError = null
    let idOrCode = params.id

    if (isUUID(idOrCode)) {
      // Find by UUID
      const result = await (serviceClient as any)
        .from('escrows')
        .select(`
          *,
          seller:profiles!seller_id(telegram_id, email, full_name, bank_name, account_number, account_holder_name, phone_number),
          buyer:profiles!buyer_id(telegram_id, email, full_name, bank_name, account_number, account_holder_name, phone_number)
        `)
        .eq('id', idOrCode)
        .single()
      escrow = result.data
      findError = result.error
    } else {
      // Try to find by code (case-insensitive)
      const result = await (serviceClient as any)
        .from('escrows')
        .select(`
          *,
          seller:profiles!seller_id(telegram_id, email, full_name, bank_name, account_number, account_holder_name, phone_number),
          buyer:profiles!buyer_id(telegram_id, email, full_name, bank_name, account_number, account_holder_name, phone_number)
        `)
        .ilike('code', idOrCode.trim())
        .single()
      escrow = result.data
      findError = result.error
    }

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

    // Include assigned admin bank info (if any), falling back to platform settings
    let adminBank: any = null
    if ((escrow as any).assigned_admin_id) {
      const { data: adminProfile } = await serviceClient
        .from('profiles')
        .select('bank_name, account_number, account_holder_name')
        .eq('id', (escrow as any).assigned_admin_id)
        .single()
      adminBank = adminProfile || null
    }

    if (!adminBank) {
      const { data: platform } = await serviceClient
        .from('admin_settings')
        .select('bank_name, account_number, account_holder')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()
      adminBank = platform || null
    }

    // Fetch status logs for timer/action logic
    const { data: statusLogs } = await serviceClient
      .from('status_logs')
      .select('id, status, created_at, changed_by')
      .eq('escrow_id', params.id)
      .order('created_at', { ascending: true })

    return NextResponse.json({
      success: true,
      escrow: {
        ...(escrow as any),
        receipts: receipts || [],
        delivery_proof_url: (escrow as any).delivery_proof_url || null,
        status_logs: statusLogs || []
      }
    })

  } catch (error) {
    console.error('Get escrow by ID error:', error)
    return NextResponse.json({ error: 'Failed to fetch transaction' }, { status: 500 })
  }
}
