export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClientWithCookies } from '@/lib/supabaseServer'
import { requireAuth } from '@/lib/rbac'

export async function POST(request: NextRequest) {
  if (request.method !== 'POST') {
    return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 })
  }
  try {
    
    // Test 1: Simple Authentication (without profile lookup)
    const supabase = createServerClientWithCookies()
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
      }
    } catch (authError: any) {
      return NextResponse.json({ error: 'Auth failed', details: authError?.message || 'Unknown auth error' }, { status: 401 })
    }

    // Test 2: Form data parsing
    try {
      const formData = await request.formData()
      const escrowId = formData.get('escrowId') as string
      const receiptFile = formData.get('file') as File
      
      if (!escrowId || !receiptFile) {
        return NextResponse.json({ error: 'Missing data', escrowId: !!escrowId, hasFile: !!receiptFile }, { status: 400 })
      }
    } catch (formError: any) {
      return NextResponse.json({ error: 'Form parse failed', details: formError?.message || 'Unknown form error' }, { status: 400 })
    }

    return NextResponse.json({ success: true, message: 'Debug tests passed' })

  } catch (error: any) {
    console.error('❌ Debug error')
    return NextResponse.json({ error: 'Debug failed', details: error?.message || 'Unknown error' }, { status: 500 })
  }
}
