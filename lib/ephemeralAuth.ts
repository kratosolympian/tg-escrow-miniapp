import { v4 as uuidv4 } from 'uuid'

type Entry = {
  userId: string
  expires: number
}

const store = new Map<string, Entry>()

export function createOneTimeToken(userId: string, ttlSeconds = 300) {
  const token = uuidv4()
  store.set(token, { userId, expires: Date.now() + ttlSeconds * 1000 })
  return token
}

export function consumeOneTimeToken(token: string) {
  const entry = store.get(token)
  if (!entry) return null
  if (Date.now() > entry.expires) {
    store.delete(token)
    return null
  }
  store.delete(token)
  return entry.userId
}

// Background cleanup (best-effort)
setInterval(() => {
  const now = Date.now()
  Array.from(store.entries()).forEach(([k, v]) => {
    if (v.expires < now) store.delete(k)
  })
}, 60 * 1000)

export default { createOneTimeToken, consumeOneTimeToken }
