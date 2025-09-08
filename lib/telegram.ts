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
