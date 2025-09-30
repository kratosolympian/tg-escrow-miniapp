// Sends a Telegram message to a user by telegram_id using the bot token from env
export async function sendTelegramMessage(telegramId: string, message: string): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    console.error('TELEGRAM_BOT_TOKEN not set')
    return false
  }
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramId,
        text: message,
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      })
    })
    const data = await resp.json()
    if (data.ok) return true
    console.error('Telegram sendMessage error:', data)
    return false
  } catch (e) {
    console.error('Telegram sendMessage exception:', e)
    return false
  }
}

// Send notification to all parties involved in an escrow transaction
export async function sendEscrowStatusNotification(
  escrowId: string,
  oldStatus: string,
  newStatus: string,
  serviceClient: any
): Promise<void> {
  try {
    // Get escrow with all involved parties
    const { data: escrow, error } = await serviceClient
      .from('escrows')
      .select(`
        id,
        code,
        description,
        price,
        seller:profiles!seller_id(id, telegram_id, full_name),
        buyer:profiles!buyer_id(id, telegram_id, full_name),
        assigned_admin_id
      `)
      .eq('id', escrowId)
      .single()

    if (error || !escrow) {
      console.error('Failed to fetch escrow for notification:', error)
      return
    }

    // Get admin's telegram ID if assigned
    let adminTelegramId = null
    if (escrow.assigned_admin_id) {
      const { data: adminProfile } = await serviceClient
        .from('profiles')
        .select('telegram_id, full_name')
        .eq('id', escrow.assigned_admin_id)
        .single()
      adminTelegramId = adminProfile?.telegram_id
    }

    // Prepare notification message
    const statusLabels: Record<string, string> = {
      'created': 'Created',
      'waiting_payment': 'Waiting for Payment',
      'waiting_admin': 'Waiting for Admin Confirmation',
      'payment_confirmed': 'Payment Confirmed',
      'in_progress': 'In Progress',
      'completed': 'Completed',
      'on_hold': 'On Hold',
      'refunded': 'Refunded',
      'closed': 'Closed'
    }

    const message = `🚨 *Escrow Status Update*

Transaction: \`${escrow.code}\`
Description: ${escrow.description}
Amount: ₦${escrow.price.toLocaleString()}

Status changed from *${statusLabels[oldStatus] || oldStatus}* to *${statusLabels[newStatus] || newStatus}*

Please check your escrow dashboard for details.`

    // Send to seller
    if (escrow.seller?.telegram_id) {
      await sendTelegramMessage(escrow.seller.telegram_id, message)
    }

    // Send to buyer
    if (escrow.buyer?.telegram_id) {
      await sendTelegramMessage(escrow.buyer.telegram_id, message)
    }

    // Send to assigned admin
    if (adminTelegramId) {
      await sendTelegramMessage(adminTelegramId, message)
    }

  } catch (error) {
    console.error('Error sending escrow status notification:', error)
  }
}

// Send chat message notification
export async function sendChatMessageNotification(
  escrowId: string,
  senderId: string,
  message: string,
  serviceClient: any
): Promise<void> {
  try {
    // Get escrow with parties
    const { data: escrow, error } = await serviceClient
      .from('escrows')
      .select(`
        id,
        code,
        seller:profiles!seller_id(id, telegram_id, full_name),
        buyer:profiles!buyer_id(id, telegram_id, full_name)
      `)
      .eq('id', escrowId)
      .single()

    if (error || !escrow) {
      console.error('Failed to fetch escrow for chat notification:', error)
      return
    }

    // Get sender info
    const { data: senderProfile } = await serviceClient
      .from('profiles')
      .select('full_name, role')
      .eq('id', senderId)
      .single()

    const senderName = senderProfile?.full_name || 'Unknown'
    const senderRole = senderProfile?.role || 'user'

    // Determine recipient
    let recipientTelegramId = null
    let recipientName = ''

    if (escrow.seller?.id === senderId) {
      // Seller sent message, notify buyer
      recipientTelegramId = escrow.buyer?.telegram_id
      recipientName = escrow.buyer?.full_name || 'Buyer'
    } else if (escrow.buyer?.id === senderId) {
      // Buyer sent message, notify seller
      recipientTelegramId = escrow.seller?.telegram_id
      recipientName = escrow.seller?.full_name || 'Seller'
    }

    if (!recipientTelegramId) {
      return // No telegram ID for recipient
    }

    // Truncate message if too long
    const truncatedMessage = message.length > 100
      ? message.substring(0, 100) + '...'
      : message

    const notificationMessage = `💬 *New Message*

From: ${senderName} (${senderRole})
Transaction: \`${escrow.code}\`

"${truncatedMessage}"

Check your escrow chat for the full conversation.`

    await sendTelegramMessage(recipientTelegramId, notificationMessage)

  } catch (error) {
    console.error('Error sending chat message notification:', error)
  }
}
import { createHmac } from 'crypto'

export interface TelegramUser {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  language_code?: string
  is_premium?: boolean
}

export function verifyTelegramInitData(initData: string, botToken: string): TelegramUser | null {
  try {
    const urlParams = new URLSearchParams(initData)
    const hash = urlParams.get('hash')
    
    if (!hash) return null
    
    // Remove hash from params for verification
    urlParams.delete('hash')
    
    // Create data-check-string
    const params = Array.from(urlParams.entries())
    params.sort(([a], [b]) => a.localeCompare(b))
    const dataCheckString = params
      .map(([key, value]) => `${key}=${value}`)
      .join('\n')
    
    // Create secret key from bot token
    const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest()
    
    // Create hash of data-check-string
    const calculatedHash = createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex')
    
    // Verify hash
    if (calculatedHash !== hash) {
      return null
    }
    
    // Parse user data
    const userParam = urlParams.get('user')
    if (!userParam) return null
    
    return JSON.parse(userParam) as TelegramUser
  } catch (error) {
    console.error('Error verifying Telegram init data:', error)
    return null
  }
}

export function deriveEmailAndPassword(telegramId: string): { email: string; password: string } {
  const authSecret = process.env.TG_AUTH_SECRET
  if (!authSecret) {
    throw new Error('TG_AUTH_SECRET is not configured')
  }
  
  const email = `tg_${telegramId}@tg.local`
  const password = createHmac('sha256', authSecret)
    .update(telegramId)
    .digest('hex')
  
  return { email, password }
}
