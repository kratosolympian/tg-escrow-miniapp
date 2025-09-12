import crypto from 'crypto'
import { createServiceRoleClient } from '@/lib/supabaseServer'

type Entry = {
  userId: string
  expires: number
}

// In-memory mapping from tokenId -> entry (fallback/local cache)
const store = new Map<string, Entry>()

// HMAC secret for signing tokens. In production, set process.env.SIGNED_TOKEN_SECRET
// to a secure random value. For dev, fall back to a deterministic value.
const SECRET = process.env.SIGNED_TOKEN_SECRET || 'dev-secret-change-me'

function hmac(data: string) {
  return crypto.createHmac('sha256', SECRET).update(data).digest('base64url')
}

// Helper to persist token id -> user to DB (best-effort). Table: one_time_tokens(id, user_id, expires_at, created_at)
async function persistTokenToDb(tokenId: string, userId: string, expires: number) {
  try {
    const svc = createServiceRoleClient()
    await (svc as any).from('one_time_tokens').insert({ id: tokenId, user_id: userId, expires_at: new Date(expires).toISOString(), created_at: new Date().toISOString() })
  } catch (e) {
    // ignore DB failures; in-memory store remains the fallback
    console.warn('persistTokenToDb failed', e)
  }
}

async function consumeTokenFromDb(tokenId: string) {
  try {
    const svc = createServiceRoleClient()
    // Attempt to atomically delete and return the user_id. Use PostgREST returning via delete with returning: ['user_id']
    const res = await (svc as any).from('one_time_tokens').delete().eq('id', tokenId).select('user_id').single()
    if (res && res.data && res.data.user_id) return res.data.user_id
    return null
  } catch (e) {
    console.warn('consumeTokenFromDb failed', e)
    return null
  }
}

// Create a signed token that encodes a tokenId and expiry. Token format:
// base64url(JSON(payload)).signature
export function createSignedToken(userId: string, ttlSeconds = 300) {
  const tokenId = crypto.randomUUID()
  const expires = Date.now() + ttlSeconds * 1000
  const payload = { id: tokenId, exp: expires }
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = hmac(payloadStr)
  const token = `${payloadStr}.${sig}`
  store.set(tokenId, { userId, expires })
  // best-effort persist to DB (don't await to keep fast)
  void persistTokenToDb(tokenId, userId, expires)
  return token
}

// Verify signature, look up mapping (DB first), check expiry, consume mapping, return userId or null
export async function verifyAndConsumeSignedToken(token: string) {
  try {
    const [payloadStr, sig] = token.split('.')
    if (!payloadStr || !sig) return null
    const expected = hmac(payloadStr)
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
    const payloadJson = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'))
    const { id: tokenId, exp } = payloadJson
    if (!tokenId || !exp) return null

    // Prefer DB-backed consumption (works across processes)
    const fromDb = await consumeTokenFromDb(tokenId)
    if (fromDb) {
      return fromDb
    }

    // Fallback to in-memory store
    const entry = store.get(tokenId)
    if (!entry) return null
    if (Date.now() > entry.expires || Date.now() > exp) {
      store.delete(tokenId)
      return null
    }
    // consume
    store.delete(tokenId)
    return entry.userId
  } catch (e) {
    return null
  }
}

// Periodic cleanup of in-memory store
setInterval(() => {
  const now = Date.now()
  store.forEach((v, k) => {
    if (v.expires < now) store.delete(k)
  })
}, 5 * 60 * 1000) // run every 5 minutes

export default { createSignedToken, verifyAndConsumeSignedToken }
