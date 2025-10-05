// Sends a Telegram message to a user by telegram_id using the bot token from env
export async function sendTelegramMessage(
  telegramId: string,
  message: string,
  inlineKeyboard?: any
): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    console.error('TELEGRAM_BOT_TOKEN not set')
    return false
  }
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`
  try {
    const payload: any = {
      chat_id: telegramId,
      text: message,
      parse_mode: 'Markdown',
      disable_web_page_preview: true
    }

    if (inlineKeyboard) {
      payload.reply_markup = inlineKeyboard
    }

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
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
  serviceClient: any,
  miniAppUrl?: string,
  changedByUserId?: string
): Promise<void> {
  // If no miniAppUrl provided, try to construct one from environment
  if (!miniAppUrl) {
    miniAppUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined
  }
  try {
    // Get escrow with all involved parties
    const { data: escrow, error } = await serviceClient
      .from('escrows')
      .select(`
        id,
        code,
        description,
        price,
        seller:profiles!seller_id(id, telegram_id, full_name, email),
        buyer:profiles!buyer_id(id, telegram_id, full_name, email),
        assigned_admin_id
      `)
      .eq('id', escrowId)
      .single()

    if (error || !escrow) {
      console.error('Failed to fetch escrow for notification:', error)
      return
    }

    // Get ALL admins' telegram IDs and emails
    const { data: allAdmins } = await serviceClient
      .from('profiles')
      .select('telegram_id, full_name, email')
      .in('role', ['admin', 'super_admin'])
      .not('telegram_id', 'is', null)

    const adminRecipients = allAdmins || []

    // Get information about who made the change (if provided)
    let changerInfo = null
    if (changedByUserId) {
      const { data: changerProfile } = await serviceClient
        .from('profiles')
        .select('telegram_id, full_name, email, role')
        .eq('id', changedByUserId)
        .single()

      if (changerProfile) {
        changerInfo = {
          name: changerProfile.full_name || 'Unknown',
          role: changerProfile.role || 'user',
          telegramId: changerProfile.telegram_id,
          email: changerProfile.email
        }
      }
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

    // Create admin-specific message with changer info
    let adminMessage = message
    if (changerInfo) {
      const contactInfo = changerInfo.telegramId
        ? `\`${changerInfo.telegramId}\``
        : changerInfo.email
        ? `\`${changerInfo.email}\``
        : 'Unknown'

      adminMessage = `🚨 *Escrow Status Update*

Transaction: \`${escrow.code}\`
Description: ${escrow.description}
Amount: ₦${escrow.price.toLocaleString()}

Status changed from *${statusLabels[oldStatus] || oldStatus}* to *${statusLabels[newStatus] || newStatus}*
Changed by: ${changerInfo.name} (${changerInfo.role}) - ${contactInfo}

Please check your escrow dashboard for details.`
    }

    // Create inline keyboard with link to escrow page
    const inlineKeyboard = miniAppUrl ? {
      inline_keyboard: [
        [
          {
            text: "View Escrow Details",
            url: `${miniAppUrl}?startapp=escrow_${escrow.code}`
          }
        ]
      ]
    } : undefined

    // Create HTML email content
    const emailSubject = `Escrow Status Update - ${escrow.code}`
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">🚨 Escrow Status Update</h2>
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Transaction:</strong> ${escrow.code}</p>
          <p><strong>Description:</strong> ${escrow.description}</p>
          <p><strong>Amount:</strong> ₦${escrow.price.toLocaleString()}</p>
          <p><strong>Status changed from:</strong> ${statusLabels[oldStatus] || oldStatus}</p>
          <p><strong>To:</strong> ${statusLabels[newStatus] || newStatus}</p>
        </div>
        <p>Please check your escrow dashboard for details.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">This is an automated notification from the Escrow Service.</p>
      </div>
    `

    // Send to seller
    if (escrow.seller?.telegram_id) {
      await sendTelegramMessage(escrow.seller.telegram_id, message, inlineKeyboard)
    }
    if (escrow.seller?.email) {
      await sendEmailNotification(escrow.seller.email, emailSubject, emailHtml)
    }

    // Create database notification for seller
    if (escrow.seller?.id) {
      await serviceClient.from('user_notifications').insert({
        user_id: escrow.seller.id,
        escrow_id: escrow.id,
        title: 'Escrow Status Updated',
        message: `Your escrow ${escrow.code} status changed to ${statusLabels[newStatus] || newStatus}`,
        type: 'info',
        action_text: 'Refresh',
        escrow_code: escrow.code
      })
    }

    // Send to buyer
    if (escrow.buyer?.telegram_id) {
      await sendTelegramMessage(escrow.buyer.telegram_id, message, inlineKeyboard)
    }
    if (escrow.buyer?.email) {
      await sendEmailNotification(escrow.buyer.email, emailSubject, emailHtml)
    }

    // Create database notification for buyer
    if (escrow.buyer?.id) {
      await serviceClient.from('user_notifications').insert({
        user_id: escrow.buyer.id,
        escrow_id: escrow.id,
        title: 'Escrow Status Updated',
        message: `Your escrow ${escrow.code} status changed to ${statusLabels[newStatus] || newStatus}`,
        type: 'info',
        action_text: 'Refresh',
        escrow_code: escrow.code
      })
    }

    // Send to ALL admins with changer info
    for (const admin of adminRecipients) {
      if (admin.telegram_id) {
        await sendTelegramMessage(admin.telegram_id, adminMessage, inlineKeyboard)
      }
      if (admin.email) {
        await sendEmailNotification(admin.email, emailSubject, emailHtml)
      }

      // Create database notification for admin
      await serviceClient.from('user_notifications').insert({
        user_id: admin.id,
        escrow_id: escrow.id,
        title: 'Escrow Status Updated',
        message: `Escrow ${escrow.code} status changed to ${statusLabels[newStatus] || newStatus}`,
        type: 'info',
        action_text: 'Refresh',
        escrow_code: escrow.code
      })
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
  serviceClient: any,
  miniAppUrl?: string
): Promise<void> {
  try {
    // Get escrow with parties
    const { data: escrow, error } = await serviceClient
      .from('escrows')
      .select(`
        id,
        code,
        seller:profiles!seller_id(id, telegram_id, full_name, email),
        buyer:profiles!buyer_id(id, telegram_id, full_name, email)
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

    // Create inline keyboard with link to escrow chat
    const inlineKeyboard = miniAppUrl ? {
      inline_keyboard: [
        [
          {
            text: "View Chat",
            url: `${miniAppUrl}?startapp=chat_${escrow.code}`
          }
        ]
      ]
    } : undefined

    // Get ALL admins for chat notifications (Telegram only)
    const { data: allAdmins } = await serviceClient
      .from('profiles')
      .select('telegram_id, full_name')
      .in('role', ['admin', 'super_admin'])
      .not('telegram_id', 'is', null)

    const adminRecipients = allAdmins || []

    // Send Telegram notifications only (no email for chat messages to preserve quota)
    await sendTelegramMessage(recipientTelegramId, notificationMessage, inlineKeyboard)

    // Send to ALL admins via Telegram
    for (const admin of adminRecipients) {
      if (admin.telegram_id) {
        await sendTelegramMessage(admin.telegram_id, notificationMessage, inlineKeyboard)
      }
    }

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

// Email notification utilities
export async function sendEmailNotification(
  toEmail: string,
  subject: string,
  htmlContent: string,
  textContent?: string
): Promise<boolean> {
  const emailService = process.env.EMAIL_SERVICE || 'resend' // Default to Resend
  const apiKey = process.env.EMAIL_API_KEY

  if (!apiKey) {
    console.error('EMAIL_API_KEY not set')
    return false
  }

  try {
    let response

    switch (emailService.toLowerCase()) {
      case 'resend':
        response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM || 'noreply@escrow-service.com',
            to: [toEmail],
            subject,
            html: htmlContent,
            text: textContent || htmlContent.replace(/<[^>]*>/g, '')
          })
        })
        break

      case 'sendgrid':
        response = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            personalizations: [{
              to: [{ email: toEmail }]
            }],
            from: { email: process.env.EMAIL_FROM || 'noreply@escrow-service.com' },
            subject,
            content: [
              {
                type: 'text/html',
                value: htmlContent
              }
            ]
          })
        })
        break

      default:
        console.error(`Unsupported email service: ${emailService}`)
        return false
    }

    if (response.ok) {
      return true
    } else {
      const errorData = await response.text()
      console.error(`Email service error (${response.status}):`, errorData)
      return false
    }
  } catch (error) {
    console.error('Email sending exception:', error)
    return false
  }
}
