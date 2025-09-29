import fetch from 'node-fetch'
import fetchCookie from 'fetch-cookie'
import { CookieJar } from 'tough-cookie'

const BASE = process.env.BASE_URL || 'http://localhost:3000'
const jar = new CookieJar()
const cookieFetch = fetchCookie(fetch, jar)

async function devSignin(email) {
  const res = await cookieFetch(`${BASE}/api/dev/signin`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email })
  })
  const j = await res.json().catch(() => null)
  return { ok: res.ok, status: res.status, body: j }
}

async function fetchEscrowPage(code) {
  const res = await cookieFetch(`${BASE}/api/escrow/by-id/${code}`, { method: 'GET' })
  const text = await res.text()
  try { return { ok: res.ok, status: res.status, body: JSON.parse(text) } } catch { return { ok: res.ok, status: res.status, body: text } }
}

async function main() {
  const code = process.env.CODE || 'MG171MFW7GRE'
  const buyerEmail = process.env.BUYER_EMAIL || 'buy@kratos.ng'

  console.log('Signing in as', buyerEmail)
  const login = await devSignin(buyerEmail)
  console.log('Signin result', login.status)
  if (!login.ok) {
    console.error('Dev signin failed', login.body)
    process.exit(1)
  }

  console.log('Fetching /api/auth/me to confirm session...')
  const meRes = await cookieFetch(`${BASE}/api/auth/me`, { method: 'GET' })
  const meText = await meRes.text()
  let meJson = null
  try { meJson = JSON.parse(meText) } catch { meJson = meText }
  console.log('/api/auth/me status', meRes.status)
  if (!meRes.ok) {
    console.error('/api/auth/me failed', meRes.status, meJson)
    process.exit(1)
  }

  console.log('Fetching escrow via service endpoint...')
  const escrow = await fetchEscrowPage(code)
  console.log('/api/escrow/by-id status', escrow.status)
  if (!escrow.ok) {
    console.error('Escrow fetch failed', escrow.status, escrow.body)
    process.exit(1)
  }

  // Ensure buyer_id matches signed-in user
  const signedInId = (meJson && meJson.user && meJson.user.id) ? meJson.user.id : null
  const escrowBuyerId = escrow.body && escrow.body.escrow && escrow.body.escrow.buyer_id ? escrow.body.escrow.buyer_id : null
  console.log('signedInId', signedInId, 'escrowBuyerId', escrowBuyerId)
  if (signedInId && escrowBuyerId && signedInId === escrowBuyerId) {
    console.log('Session user matches escrow buyer — success')
    process.exit(0)
  }
  console.error('Signed-in user does not match escrow buyer')
  process.exit(2)
}

main().catch(e => { console.error(e); process.exit(1) })
