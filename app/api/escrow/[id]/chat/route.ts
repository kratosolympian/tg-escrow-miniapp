import { NextRequest, NextResponse } from 'next/server'
import { createServerClientWithCookies, createServiceRoleClient } from '@/lib/supabaseServer'
import { requireAuth, canAccessEscrow, isAdmin } from '@/lib/rbac'
import { sendChatMessageNotification } from '@/lib/telegram';

// Get chat messages for an escrow
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClientWithCookies();
    
    // Get current user and check permissions
    const profile = await requireAuth(supabase); // Any authenticated user can try
    
    // Use service role client to read escrow
    const serviceClient = createServiceRoleClient()
    const { data: escrow, error: escrowError } = await serviceClient
      .from('escrows')
      .select('seller_id, buyer_id')
      .eq('id', params.id)
      .single()

    if (escrowError || !escrow) {
      return NextResponse.json({ error: 'Escrow not found' }, { status: 404 })
    }

    // Check if user can access this escrow
    if (!canAccessEscrow(profile, { seller_id: escrow.seller_id || '', buyer_id: escrow.buyer_id })) {
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
    if (!isAdmin(profile)) {
      const updateObj: any = { is_read: true }
      await serviceClient
        .from('chat_messages')
        .update(updateObj)
        .eq('escrow_id', params.id)
        .neq('sender_id', profile.id)
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
    
    // Get current user and check permissions
    const profile = await requireAuth(supabase); // Any authenticated user can try
    
    const body = await request.json()
    const { message, message_type = 'text' } = body

    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 })
    }

    if (message.length > 500) {
      return NextResponse.json({ error: 'Message too long (max 500 characters)' }, { status: 400 })
    }

    // Use service client to read escrow
    const serviceClient = createServiceRoleClient()
    const { data: escrow, error: escrowError } = await serviceClient
      .from('escrows')
      .select('seller_id, buyer_id')
      .eq('id', params.id)
      .single()

    if (escrowError || !escrow) {
      return NextResponse.json({ error: 'Escrow not found' }, { status: 404 })
    }

    // Check if user can access this escrow
    if (!canAccessEscrow(profile, { seller_id: escrow.seller_id || '', buyer_id: escrow.buyer_id })) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Insert the message
    const insertObj: any = {
      escrow_id: params.id,
      sender_id: profile.id,
      message: message.trim(),
      message_type,
      is_read: false
    }
    // Insert message and return inserted row including sender profile
    const { data: newMessage, error: insertError } = await serviceClient
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
          user_id: profile.id,
          escrow_buyer_id: escrow.buyer_id,
          escrow_seller_id: escrow.seller_id,
          insert_sender_id: profile.id,
          insertObj,
          insertError
        }
      }, { status: 500 })
    }


    // Add user to chat participants if not already there
    const upsertObj: any = {
      escrow_id: params.id,
      user_id: profile.id,
      last_read_at: new Date().toISOString()
    }
    await serviceClient
      .from('chat_participants')
      .upsert(upsertObj, { onConflict: 'escrow_id,user_id' })

    // Send Telegram notifications for the new chat message
    await sendChatMessageNotification(params.id, profile.id, message.trim(), serviceClient, process.env.TELEGRAM_MINIAPP_URL)

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
