import fs from 'fs'
import path from 'path'
import fetch from 'node-fetch'
import { CookieJar } from 'tough-cookie'
import fetchCookie from 'fetch-cookie'
import dotenv from 'dotenv'

// Load local env file if present
const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath })
}

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
let SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY
let SUPABASE_PROJECT_URL = process.env.SUPABASE_PROJECT_URL || null
if (!SUPABASE_PROJECT_URL && process.env.NEXT_PUBLIC_SUPABASE_URL) {
  SUPABASE_PROJECT_URL = process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

if (!SERVICE_ROLE || !SUPABASE_PROJECT_URL) {
  console.error('Please set SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_PROJECT_URL) in .env.local or environment')
  process.exit(2)
}

const SELLER_EMAIL = process.env.SELLER_EMAIL || `repro.seller+${Date.now()}@example.com`
const BUYER_EMAIL = process.env.BUYER_EMAIL || `repro.buyer+${Date.now()}@example.com`
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'Password123!'

const sellerJar = new CookieJar()
const buyerJar = new CookieJar()
const sellerFetch = fetchCookie(fetch, sellerJar)
const buyerFetch = fetchCookie(fetch, buyerJar)

async function adminCreateUser(email, password, full_name = '') {
  console.log('Admin create user:', email)
  const url = `https://${SUPABASE_PROJECT_URL}/auth/v1/admin/users`
  const headers = { 'Content-Type': 'application/json', 'apikey': SERVICE_ROLE, 'Authorization': `Bearer ${SERVICE_ROLE}` }
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ email, password, user_metadata: { full_name }, email_confirm: true, email_confirmed_at: new Date().toISOString() }) })
  const text = await res.text()
  let body
  try { body = JSON.parse(text) } catch { body = text }
  console.log('Admin create response:', res.status, body)
  if (!res.ok) throw new Error('Admin create user failed')
  return body
}

async function login(fetcher, email, password) {
  console.log('Login', email)
  const url = `${BASE_URL}/api/auth/login`
  const res = await fetcher(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
  const text = await res.text()
  let body
  try { body = JSON.parse(text) } catch { body = text }
  console.log('Login response:', res.status, body)
  if (!res.ok) throw new Error('Login failed')
  return body.__one_time_token || null
}

async function createEscrow(fetcher, token) {
  console.log('Create escrow')
  const url = `${BASE_URL}/api/escrow/create`
  const form = new (await import('form-data')).default()
  form.append('description', 'Repro product')
  form.append('price', '100')
  const headers = form.getHeaders()
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetcher(url, { method: 'POST', headers, body: form })
  const text = await res.text()
  let body
  try { body = JSON.parse(text) } catch { body = text }
  console.log('Create escrow response:', res.status, body)
  if (!res.ok) throw new Error('Create escrow failed')
  return { code: body.code, escrowId: body.escrowId }
}

async function joinEscrow(fetcher, token, code) {
  console.log('Join escrow with code', code)
  const url = `${BASE_URL}/api/escrow/join`
  const res = await fetcher(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ code }) })
  const text = await res.text()
  let body
  try { body = JSON.parse(text) } catch { body = text }
  console.log('Join response:', res.status, body)
  if (!res.ok) throw new Error('Join failed')
  return body
}

async function fetchEscrowAsAuth(id, cookieJar) {
  console.log('Fetch escrow as authenticated user (PostgREST)')
  const cookies = await new Promise((res) => cookieJar.getCookies(BASE_URL, (e, c) => res(c)))
  const sbTokenCookie = cookies.find(c => c.key === 'sb:token' || c.key === 'sb_token' || c.key === 'sb-token')
  const accessToken = sbTokenCookie ? sbTokenCookie.value : null
  console.log('Access token present?', !!accessToken)
  const url = `https://${SUPABASE_PROJECT_URL}/rest/v1/escrows?select=*&id=eq.${id}`
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const headers = Object.assign({}, accessToken ? { Authorization: `Bearer ${accessToken}` } : {}, anonKey ? { apikey: anonKey } : {})
  console.log('PostgREST request headers keys:', Object.keys(headers))
  const res = await fetch(url, { method: 'GET', headers })
  const text = await res.text()
  let body
  try { body = JSON.parse(text) } catch { body = text }
  console.log('PostgREST response status:', res.status)
  console.log('PostgREST response body:', body)
  return { status: res.status, body }
}

async function main() {
  try {
    const seller = await adminCreateUser(SELLER_EMAIL, TEST_PASSWORD, 'Repro Seller')
    const buyer = await adminCreateUser(BUYER_EMAIL, TEST_PASSWORD, 'Repro Buyer')

    const sellerToken = await login(sellerFetch, SELLER_EMAIL, TEST_PASSWORD)
    const buyerToken = await login(buyerFetch, BUYER_EMAIL, TEST_PASSWORD)

    const escrow = await createEscrow(sellerFetch, sellerToken)
    const code = escrow.code
    const escrowId = escrow.escrowId

    await joinEscrow(buyerFetch, buyerToken, code)

    // Now reproduce the problematic action: buyer fetching escrow via PostgREST
    const resp = await fetchEscrowAsAuth(escrowId, buyerJar)
    if (resp.status >= 500) {
      console.error('Server error detected when buyer fetched escrow — possible policy recursion')
      process.exit(2)
    }

    console.log('Reproducer completed — no 500 detected')
    process.exit(0)
  } catch (err) {
    console.error('Reproducer script error:', err)
    process.exit(1)
  }
}

main()
