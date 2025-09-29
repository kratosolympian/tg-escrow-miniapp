import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // Dev-only guard
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  const url = new URL(request.url)
  const code = (url.searchParams.get('code') || '').trim()
  if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 })

  try {
    const service = createServiceRoleClient()
    const { data, error } = await (service as any)
      .from('escrows')
      .select('id, code, buyer_id, seller_id, status, created_at')
      .ilike('code', code)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, escrow: data })
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
