
'use client'
import React from 'react'

import { useState, useEffect, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { MessageList, Input } from 'react-chat-elements'
import 'react-chat-elements/dist/main.css'

// Custom styles for react-chat-elements
const customStyles = `
  .rce-container-mbox {
    margin-bottom: 8px;
  }
  
  .rce-mbox {
    max-width: 70%;
  }
  
  @media (min-width: 1024px) {
    .rce-mbox {
      max-width: 60%;
    }
  }
  
  .rce-mbox-right .rce-mbox-body {
    background-color: #2563eb !important;
    color: white !important;
  }
  
  .rce-mbox-left .rce-mbox-body {
    background-color: #f3f4f6 !important;
    color: #111827 !important;
  }
  
  .rce-mbox-title {
    font-size: 0.75rem;
    font-weight: 500;
    margin-bottom: 2px;
  }
  
  .rce-mbox-right .rce-mbox-title {
    color: white !important;
  }
  
  .rce-mbox-left .rce-mbox-title {
    color: #6b7280 !important;
  }
  
  .rce-mbox-time {
    font-size: 0.75rem;
    opacity: 0.7;
  }
  
  .rce-mbox-text {
    font-size: 0.875rem;
    line-height: 1.25rem;
    word-wrap: break-word;
    white-space: pre-wrap;
  }
  
  .system-message .rce-mbox-body {
    background-color: #f3f4f6 !important;
    color: #6b7280 !important;
    text-align: center !important;
    margin: 0 auto !important;
    max-width: 100% !important;
  }
  
  .warning-message .rce-mbox-body {
    background-color: #fef2f2 !important;
    color: #dc2626 !important;
    border: 1px solid #fecaca !important;
    max-width: 100% !important;
  }
  
  .warning-message .rce-mbox-text:before {
    content: '🚨 ';
  }
  
  .message-list {
    height: 100%;
    overflow-y: auto;
    padding: 12px;
  }
`

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
  supabaseClient?: any
}

export default React.memo(function EscrowChat({ escrowId, currentUserId, isAdmin = false, supabaseClient }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [senderCache, setSenderCache] = useState<Record<string, { full_name: string; role: string }>>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const supabase = supabaseClient || createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const loadMessages = React.useCallback(async () => {
    try {
      // Prevent concurrent loads
      if ((loadMessages as any)._inFlight) return
      ;(loadMessages as any)._inFlight = true
  const response = await fetch(`/api/escrow/${escrowId}/chat`, { credentials: 'include' })
      const data = await response.json()
      if (data.success) {
        setMessages(data.messages)
        
        // Populate sender cache from loaded messages
        const cache: Record<string, { full_name: string; role: string }> = {}
        data.messages.forEach((msg: ChatMessage) => {
          if (msg.sender && msg.sender_id) {
            cache[msg.sender_id] = msg.sender
          }
        })
        setSenderCache(cache)
        
        // If any messages lack sender.full_name, try to populate them
        const missing = (data.messages as ChatMessage[]).filter(m => !m.sender || !m.sender.full_name).map(m => m.id)
        if (missing.length) {
          // Fire-and-forget batch population
          populateMissingSenders(missing)
        }
      } else {
        setError('Failed to load messages')
      }
    } catch (err) {
      setError('Failed to load messages')
    } finally {
      ;(loadMessages as any)._inFlight = false
      setLoading(false)
    }
  }, [escrowId])

  useEffect(() => {
    loadMessages()

    // Poll for new messages every 5 seconds
    const pollInterval = setInterval(() => {
      loadMessages()
    }, 5000)

    return () => clearInterval(pollInterval)
  }, [escrowId, loadMessages])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const populateMissingSenders = async (ids: string[]) => {
    await Promise.all(ids.map(id => fetchMessageWithSender(id)))
  }


  const fetchMessageWithSender = async (messageId: string) => {
    try {
      const response = await fetch(`/api/escrow/chat/message/${messageId}`, { credentials: 'include' })
      const data = await response.json()

      if (data.success) {
        const msg = data.message as ChatMessage

        // Update sender cache
        if (msg.sender && msg.sender_id) {
          setSenderCache(prev => ({ ...prev, [msg.sender_id]: msg.sender! }))
        }

        setMessages(prev => {
          const exists = prev.find(m => m.id === msg.id)
          if (exists) {
            return prev.map(m => (m.id === msg.id ? msg : m))
          }
          return [...prev, msg]
        })
      } else {
        console.error('Failed to fetch message:', data.error)
      }
    } catch (err) {
      // Silently handle fetch errors
    }
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;
    setSending(true);
    setError('');
    try {
      const response = await fetch(`/api/escrow/${escrowId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newMessage }),
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success) {
        setNewMessage('')
        // Add message to local state immediately for instant feedback
        if (data.message) {
          const msg = data.message as ChatMessage
          setMessages(prev => {
            if (prev.find(m => m.id === msg.id)) return prev
            return [...prev, msg]
          })
        }
      } else {
        setError(data.error || 'Failed to send message')
      }
    } catch (err) {
      setError('Failed to send message')
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

  // Convert messages to react-chat-elements format (only text messages)
  const chatMessages: any[] = messages
    .filter(message => message.message_type === 'text')
    .map((message) => {
      // Try to get sender info from message or cache
      const sender = message.sender || (message.sender_id ? senderCache[message.sender_id] : null)
      
      return {
        id: message.id,
        text: message.message,
        date: new Date(message.created_at),
        type: 'text' as const,
        position: (message.sender_id === currentUserId ? 'right' : 'left') as 'right' | 'left',
        title: sender?.full_name || 'Unknown',
        avatar: false, // Disable avatar to prevent broken image icons
        status: message.is_read ? 'read' : 'sent'
      }
    })

  // Separate system and warning messages
  const systemMessages = messages.filter(message => message.message_type === 'system')
  const warningMessages = messages.filter(message => message.message_type === 'warning')

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading chat...</span>
      </div>
    )
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: customStyles }} />
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      {/* Chat Header */}
      <div className="border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">💬 Escrow Chat</h3>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
              POLLING
            </span>
            {isAdmin && (
              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                👨‍💼 Admin View
              </span>
            )}
          </div>
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

      {/* Enhanced Messages Area with react-chat-elements */}
      <div className="h-96 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <div className="text-4xl mb-2">💭</div>
            <p className="text-center">No messages yet</p>
            <p className="text-sm text-center mt-1">Start the conversation to discuss transaction details</p>
          </div>
        ) : (
          <div className="p-3 space-y-3">
            {/* System Messages */}
            {systemMessages.map((message) => (
              <div key={message.id} className="bg-gray-100 text-gray-600 text-center py-2 px-3 rounded-lg text-sm">
                {message.message}
              </div>
            ))}
            
            {/* Warning Messages */}
            {warningMessages.map((message) => (
              <div key={message.id} className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex">
                  <div className="text-red-400 mr-2">🚨</div>
                  <div className="text-sm text-red-700">{message.message}</div>
                </div>
              </div>
            ))}
            
            {/* Text Messages with react-chat-elements */}
            {chatMessages.length > 0 && (
              <MessageList
                className="message-list"
                lockable={true}
                toBottomHeight={'100%'}
                dataSource={chatMessages}
                referance={null}
              />
            )}
          </div>
        )}
      </div>

      {/* Enhanced Input with react-chat-elements */}
      {!isAdmin && (
        <div className="border-t border-gray-200 p-4">
          {error && (
            <div className="mb-3 bg-red-50 border border-red-200 rounded-md p-2">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}
          
          <form onSubmit={sendMessage} className="flex gap-2">
            <Input
              placeholder="Type your message..."
              value={newMessage}
              onChange={(e: any) => setNewMessage(e.target.value)}
              maxlength={500}
              maxHeight={200}
              className="flex-1"
              rightButtons={
                <button
                  type="submit"
                  disabled={sending || !newMessage.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? '📤' : '➤'}
                </button>
              }
            />
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
    </>
  )
})
