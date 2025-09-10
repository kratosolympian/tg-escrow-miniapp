'use client'

import { useState, useEffect, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'

interface ChatMessage {
  id: string
  escrow_id: string
  sender_id: string
  message: string
  message_type: 'text' | 'system' | 'warning'
  is_read: boolean
  created_at: string
  sender: {
    full_name: string
    role: string
  }
}

interface ChatProps {
  escrowId: string
  currentUserId: string
  isAdmin?: boolean
}

export default function EscrowChat({ escrowId, currentUserId, isAdmin = false }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    loadMessages()
    
    // Set up real-time subscription for new messages
    const channel = supabase
      .channel(`escrow-chat-${escrowId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `escrow_id=eq.${escrowId}`
      }, (payload) => {
        // Fetch the complete message with sender info
        fetchMessageWithSender(payload.new.id as string)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [escrowId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadMessages = async () => {
    try {
      const response = await fetch(`/api/escrow/${escrowId}/chat`)
      const data = await response.json()
      
      if (data.success) {
        setMessages(data.messages)
      } else {
        setError('Failed to load messages')
      }
    } catch (err) {
      setError('Failed to load messages')
      console.error('Load messages error:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchMessageWithSender = async (messageId: string) => {
    try {
      const response = await fetch(`/api/escrow/chat/message/${messageId}`)
      const data = await response.json()
      
      if (data.success) {
        setMessages(prev => [...prev, data.message])
      }
    } catch (err) {
      console.error('Fetch message error:', err)
    }
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newMessage.trim() || sending) return

    setSending(true)
    setError('')

    try {
      const response = await fetch(`/api/escrow/${escrowId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: newMessage.trim(),
          message_type: 'text'
        }),
      })

      const data = await response.json()

      if (data.success) {
        setNewMessage('')
        // Message will be added via real-time subscription
      } else {
        setError(data.error || 'Failed to send message')
      }
    } catch (err) {
      setError('Failed to send message')
      console.error('Send message error:', err)
    } finally {
      setSending(false)
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading chat...</span>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      {/* Chat Header */}
      <div className="border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">💬 Escrow Chat</h3>
          {isAdmin && (
            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
              👨‍💼 Admin View
            </span>
          )}
        </div>
        
        {/* Warning Message */}
        <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="flex">
            <div className="text-amber-400 mr-2">⚠️</div>
            <div className="text-sm">
              <p className="text-amber-800 font-medium mb-1">Important Security Notice</p>
              <p className="text-amber-700">
                Keep all communication within this chat. Taking conversations outside the escrow system 
                means admin cannot provide assistance or intervention if disputes arise.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="h-96 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <div className="text-4xl mb-2">💭</div>
            <p className="text-center">No messages yet</p>
            <p className="text-sm text-center mt-1">Start the conversation to discuss transaction details</p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div key={message.id} className={`flex ${
                message.sender_id === currentUserId ? 'justify-end' : 'justify-start'
              }`}>
                <div className={`max-w-xs lg:max-w-md ${
                  message.message_type === 'system' 
                    ? 'mx-auto' 
                    : message.message_type === 'warning'
                    ? 'w-full'
                    : ''
                }`}>
                  {message.message_type === 'system' && (
                    <div className="bg-gray-100 text-gray-600 text-center py-2 px-3 rounded-lg text-sm">
                      {message.message}
                    </div>
                  )}
                  
                  {message.message_type === 'warning' && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <div className="flex">
                        <div className="text-red-400 mr-2">🚨</div>
                        <div className="text-sm text-red-700">{message.message}</div>
                      </div>
                    </div>
                  )}

                  {message.message_type === 'text' && (
                    <div className={`rounded-lg px-3 py-2 ${
                      message.sender_id === currentUserId
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-medium ${
                          message.sender_id === currentUserId ? 'text-blue-200' : 'text-gray-500'
                        }`}>
                          {message.sender.role === 'admin' ? '👨‍💼 Admin' : 
                           message.sender.role === 'seller' ? '💼 Seller' : '🛒 Buyer'}
                        </span>
                        <span className={`text-xs ${
                          message.sender_id === currentUserId ? 'text-blue-200' : 'text-gray-500'
                        }`}>
                          {formatTimestamp(message.created_at)}
                        </span>
                      </div>
                      <p className="text-sm">{message.message}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Message Input */}
      {!isAdmin && (
        <div className="border-t border-gray-200 px-4 py-3">
          {error && (
            <div className="mb-3 bg-red-50 border border-red-200 rounded-md p-2">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}
          
          <form onSubmit={sendMessage} className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              disabled={sending}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              maxLength={500}
            />
            <button
              type="submit"
              disabled={sending || !newMessage.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? '📤' : '➤'}
            </button>
          </form>
          
          <p className="text-xs text-gray-500 mt-1">
            {newMessage.length}/500 characters
          </p>
        </div>
      )}

      {/* Admin View Only */}
      {isAdmin && (
        <div className="border-t border-gray-200 px-4 py-3 bg-gray-50">
          <p className="text-sm text-gray-600 text-center">
            👁️ Admin monitoring mode - You can view all messages but cannot send messages directly
          </p>
        </div>
      )}
    </div>
  )
}
