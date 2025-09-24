export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClientWithAuthHeader, createServiceRoleClient } from '@/lib/supabaseServer'

export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
  const supabase = createServerClientWithAuthHeader(request)
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

    console.log('Buyer API: Found escrow', (escrow as any).id, 'with status', (escrow as any).status, 'for code:', params.code.toUpperCase())

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

    // Generate signed URLs for receipts
    let receiptsWithUrls = receipts || []
    if (receipts && receipts.length > 0) {
      receiptsWithUrls = await Promise.all(receipts.map(async (receipt) => {
        try {
          const { data: signedUrlData, error } = await serviceClient.storage
            .from('receipts')
            .createSignedUrl(receipt.file_path, 900) // 15 minutes

          if (error) {
            console.warn('Failed to create signed URL for receipt:', receipt.file_path, error)
            return { ...receipt, signed_url: null }
          }

          return { ...receipt, signed_url: signedUrlData.signedUrl }
        } catch (err) {
          console.warn('Error creating signed URL for receipt:', receipt.file_path, err)
          return { ...receipt, signed_url: null }
        }
      }))
    }

    // Attach assigned admin bank data (profile) or platform fallback
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

    return NextResponse.json({
      ...(escrow as any),
      status_logs: statusLogs || [],
      receipts: receiptsWithUrls || [],
      admin_bank: adminBank
    })

  } catch (error) {
    console.error('Get escrow by code error:', error)
    return NextResponse.json({ error: 'Failed to fetch transaction' }, { status: 500 })
  }
}
