export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClientWithCookies } from '@/lib/supabaseServer'
import { requireAuth } from '@/lib/rbac'

export async function POST(request: NextRequest) {
  if (request.method !== 'POST') {
  if (process.env.DEBUG) console.log('405 - Method Not Allowed:', request.method, request.url)
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 })
  }
  try {
  if (process.env.DEBUG) console.log('=== DEBUG RECEIPT UPLOAD ===')
    
    // Test 1: Simple Authentication (without profile lookup)
    const supabase = createServerClientWithCookies()
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user) {
        if (process.env.DEBUG) console.log('❌ Basic auth failed')
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
      }
      if (process.env.DEBUG) console.log('✅ Basic authentication successful for user id:', user.id)
    } catch (authError: any) {
      if (process.env.DEBUG) console.log('❌ Authentication failed')
      return NextResponse.json({ error: 'Auth failed', details: authError?.message || 'Unknown auth error' }, { status: 401 })
    }

    // Test 2: Form data parsing
    try {
      const formData = await request.formData()
      const escrowId = formData.get('escrowId') as string
      const receiptFile = formData.get('file') as File
      
  if (process.env.DEBUG) console.log('✅ Form data parsed: escrowId=', escrowId, 'hasFile=', !!receiptFile)
      
      if (!escrowId || !receiptFile) {
        return NextResponse.json({ error: 'Missing data', escrowId: !!escrowId, hasFile: !!receiptFile }, { status: 400 })
      }
    } catch (formError: any) {
      if (process.env.DEBUG) console.log('❌ Form parsing failed')
      return NextResponse.json({ error: 'Form parse failed', details: formError?.message || 'Unknown form error' }, { status: 400 })
    }

    return NextResponse.json({ success: true, message: 'Debug tests passed' })

  } catch (error: any) {
    console.error('❌ Debug error')
    return NextResponse.json({ error: 'Debug failed', details: error?.message || 'Unknown error' }, { status: 500 })
  }
}
