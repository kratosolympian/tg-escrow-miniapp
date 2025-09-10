import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Get chat messages for an escrow
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          },
        },
      }
    )

    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user has access to this escrow
    const { data: escrow, error: escrowError } = await supabase
      .from('escrows')
      .select('seller_id, buyer_id')
      .eq('id', params.id)
      .single()

    if (escrowError || !escrow) {
      return NextResponse.json({ error: 'Escrow not found' }, { status: 404 })
    }

    // Check if user is admin
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()

    const isAdmin = userProfile?.role === 'admin'
    const hasAccess = isAdmin || escrow.seller_id === session.user.id || escrow.buyer_id === session.user.id

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get chat messages with sender info
    const { data: messages, error: messagesError } = await supabase
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
      console.error('Messages fetch error:', messagesError)
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
    }

    // Mark messages as read for current user
    if (!isAdmin) {
      await supabase
        .from('chat_messages')
        .update({ is_read: true })
        .eq('escrow_id', params.id)
        .neq('sender_id', session.user.id)
    }

    return NextResponse.json({
      success: true,
      messages: messages || []
    })

  } catch (error) {
    console.error('Get chat messages error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Send a new chat message
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          },
        },
      }
    )

    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { message, message_type = 'text' } = body

    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 })
    }

    if (message.length > 500) {
      return NextResponse.json({ error: 'Message too long (max 500 characters)' }, { status: 400 })
    }

    // Verify user has access to this escrow
    const { data: escrow, error: escrowError } = await supabase
      .from('escrows')
      .select('seller_id, buyer_id')
      .eq('id', params.id)
      .single()

    if (escrowError || !escrow) {
      return NextResponse.json({ error: 'Escrow not found' }, { status: 404 })
    }

    // Check if user is admin
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()

    const isAdmin = userProfile?.role === 'admin'
    const hasAccess = isAdmin || escrow.seller_id === session.user.id || escrow.buyer_id === session.user.id

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Insert the message
    const { data: newMessage, error: insertError } = await supabase
      .from('chat_messages')
      .insert({
        escrow_id: params.id,
        sender_id: session.user.id,
        message: message.trim(),
        message_type,
        is_read: false
      })
      .select()
      .single()

    if (insertError) {
      console.error('Message insert error:', insertError)
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }


    // Add user to chat participants if not already there
    await supabase
      .from('chat_participants')
      .upsert(
        {
          escrow_id: params.id,
          user_id: session.user.id,
          last_read_at: new Date().toISOString()
        },
        { onConflict: 'escrow_id,user_id' }
      )

    return NextResponse.json({
      success: true,
      message: newMessage
    })

  } catch (error) {
    console.error('Send chat message error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
