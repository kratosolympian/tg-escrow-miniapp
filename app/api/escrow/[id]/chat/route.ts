import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServerClientWithCookies } from '@/lib/supabaseServer'

// Get chat messages for an escrow
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
  const supabase = createServerClientWithCookies()
  const sb: any = supabase
    // Get current user (guarded)
    let user = null
    try {
      const r = await supabase.auth.getUser()
      user = r?.data?.user ?? null
    } catch (e) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Verify user has access to this escrow
    const { data: escrow, error: escrowError } = await sb
      .from('escrows')
      .select('seller_id, buyer_id')
      .eq('id', params.id)
      .single()

    if (escrowError || !escrow) {
      return NextResponse.json({ error: 'Escrow not found' }, { status: 404 })
    }

    // Check if user is admin
    const { data: userProfile } = await sb
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
  const userProfileAny: any = userProfile
  const escrowAny: any = escrow
  const isAdmin = userProfileAny && userProfileAny.role === 'admin'
  const hasAccess = isAdmin || escrowAny.seller_id === user.id || escrowAny.buyer_id === user.id

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get chat messages with sender info
  const { data: messages, error: messagesError } = await sb
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
      .eq('escrow_id', params.id)
      .order('created_at', { ascending: true })

    if (messagesError) {
  // ...removed for production...
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
    }

    // Mark messages as read for current user
    if (!isAdmin) {
      const updateObj: any = { is_read: true }
      await sb
        .from('chat_messages')
        .update(updateObj)
        .eq('escrow_id', params.id)
        .neq('sender_id', user.id)
    }

    return NextResponse.json({
      success: true,
      messages: messages || []
    })

  } catch (error) {
  // ...removed for production...
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Send a new chat message
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
  const supabase = createServerClientWithCookies()
  const sb: any = supabase
    // Get current user (guarded)
    let user = null
    try {
      const r = await supabase.auth.getUser()
      user = r?.data?.user ?? null
    } catch (e) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { message, message_type = 'text' } = body

    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 })
    }

    if (message.length > 500) {
      return NextResponse.json({ error: 'Message too long (max 500 characters)' }, { status: 400 })
    }

    // Verify user has access to this escrow
    const { data: escrow, error: escrowError } = await sb
      .from('escrows')
      .select('seller_id, buyer_id')
      .eq('id', params.id)
      .single()

    if (escrowError || !escrow) {
      return NextResponse.json({ error: 'Escrow not found' }, { status: 404 })
    }

    // Check if user is admin
    const { data: userProfile } = await sb
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

  const userProfileAny2: any = userProfile
  const escrowAny2: any = escrow
  const isAdmin = userProfileAny2 && userProfileAny2.role === 'admin'
  const hasAccess = isAdmin || escrowAny2.seller_id === user.id || escrowAny2.buyer_id === user.id

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Insert the message
    const insertObj: any = {
      escrow_id: params.id,
      sender_id: user.id,
      message: message.trim(),
      message_type,
      is_read: false
    }
    const { data: newMessage, error: insertError } = await sb
      .from('chat_messages')
      .insert(insertObj)
      .select()
      .single()

    if (insertError) {
  // ...removed for production...
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }


    // Add user to chat participants if not already there
    const upsertObj: any = {
      escrow_id: params.id,
      user_id: user.id,
      last_read_at: new Date().toISOString()
    }
    await sb
      .from('chat_participants')
      .upsert(upsertObj, { onConflict: 'escrow_id,user_id' })

    return NextResponse.json({
      success: true,
      message: newMessage
    })

  } catch (error) {
  // ...removed for production...
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
