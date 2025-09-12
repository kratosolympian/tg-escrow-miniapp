import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServerClientWithCookies } from '@/lib/supabaseServer'

// Get individual message with sender info
export async function GET(
  request: NextRequest,
  { params }: { params: { messageId: string } }
) {
  try {
  const supabase = createServerClientWithCookies() as any

    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get message with sender info
  const { data: message, error: messageError } = await supabase
      .from('chat_messages')
      .select(`
        id,
        escrow_id,
        sender_id,
        message,
        message_type,
        is_read,
        created_at,
        sender:profiles!sender_id(full_name, role)
      `)
      .eq('id', params.messageId)
      .single()

    if (messageError || !message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    // Verify user has access to this escrow
    const { data: escrow, error: escrowError } = await supabase
      .from('escrows')
      .select('seller_id, buyer_id')
      .eq('id', (message as any).escrow_id)
      .single()

    if (escrowError || !escrow) {
      return NextResponse.json({ error: 'Escrow not found' }, { status: 404 })
    }

    // Check access
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()

  const isAdmin = userProfile && (userProfile as any).role === 'admin'
  const hasAccess = isAdmin || (escrow as any).seller_id === session.user.id || (escrow as any).buyer_id === session.user.id

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    return NextResponse.json({
      success: true,
      message
    })

  } catch (error) {
    console.error('Get message error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
