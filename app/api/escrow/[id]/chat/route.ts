import { NextRequest, NextResponse } from 'next/server'
import { createServerClientWithCookies, createServiceRoleClient } from '@/lib/supabaseServer';

// Get chat messages for an escrow
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClientWithCookies();
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

    // Use service role client to read escrow (server enforces access control below)
    const serviceClient = createServiceRoleClient()
    const { data: escrow, error: escrowError } = await serviceClient
      .from('escrows')
      .select('seller_id, buyer_id')
      .eq('id', params.id)
      .single()

    if (escrowError || !escrow) {
      return NextResponse.json({ error: 'Escrow not found' }, { status: 404 })
    }

    // Check if user is admin by consulting admin_users (using service client)
    const { data: adminRow } = await serviceClient
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()
    const isAdmin = !!adminRow
    const escrowAny: any = escrow
    const hasAccess = isAdmin || escrowAny.seller_id === user.id || escrowAny.buyer_id === user.id

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get chat messages and include sender profile (server-side service client can join safely)
  const { data: messages, error: messagesError } = await serviceClient
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

    // Mark messages as read for current user (service client, server-side check already done)
    if (!isAdmin) {
      const updateObj: any = { is_read: true }
      await serviceClient
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
    const supabase = createServerClientWithCookies();
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

    // Use service client to read escrow (server enforces access control below)
    const serviceClient2 = createServiceRoleClient()
    const { data: escrow, error: escrowError } = await serviceClient2
      .from('escrows')
      .select('seller_id, buyer_id')
      .eq('id', params.id)
      .single()

    if (escrowError || !escrow) {
      return NextResponse.json({ error: 'Escrow not found' }, { status: 404 })
    }

    // Check if user is admin by consulting admin_users table (service client)
    const { data: adminRow2 } = await serviceClient2
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()

  const isAdmin = !!adminRow2
  const escrowAny2: any = escrow
  const hasAccess = isAdmin || escrowAny2.seller_id === user.id || escrowAny2.buyer_id === user.id


    if (!hasAccess) {
      return NextResponse.json({
        error: 'Access denied',
        debug: {
          user_id: user.id,
          escrow_buyer_id: escrowAny2.buyer_id,
          escrow_seller_id: escrowAny2.seller_id,
          insert_sender_id: user.id,
          insertObj: {
            escrow_id: params.id,
            sender_id: user.id,
            message: message.trim(),
            message_type,
            is_read: false
          }
        }
      }, { status: 403 })
    }

    // Insert the message
    const insertObj: any = {
      escrow_id: params.id,
      sender_id: user.id,
      message: message.trim(),
      message_type,
      is_read: false
    }
    // Insert message and return inserted row including sender profile
    const { data: newMessage, error: insertError } = await serviceClient2
      .from('chat_messages')
      .insert(insertObj)
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
      .single()

    if (insertError) {
      if ((process.env.NODE_ENV as string) !== 'production') {
        console.error('[DEBUG] Insert chat message failed', { insertError, insertObj });
      }
      return NextResponse.json({
        error: 'Failed to send message',
        debug: {
          user_id: user.id,
          escrow_buyer_id: escrowAny2.buyer_id,
          escrow_seller_id: escrowAny2.seller_id,
          insert_sender_id: user.id,
          insertObj,
          insertError
        }
      }, { status: 500 })
    }


    // Add user to chat participants if not already there
    const upsertObj: any = {
      escrow_id: params.id,
      user_id: user.id,
      last_read_at: new Date().toISOString()
    }
    await serviceClient2
      .from('chat_participants')
      .upsert(upsertObj, { onConflict: 'escrow_id,user_id' })

    return NextResponse.json({
      success: true,
      message: newMessage
    })

  } catch (error) {
    if ((process.env.NODE_ENV as string) !== 'production') {
      console.error('[DEBUG] POST /api/escrow/[id]/chat error', error);
    }
    return NextResponse.json({ error: 'Internal server error', debug: String(error) }, { status: 500 })
  }
}
