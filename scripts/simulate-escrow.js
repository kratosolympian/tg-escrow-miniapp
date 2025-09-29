import fs from 'fs'
import path from 'path'
import fetch from 'node-fetch'
import FormData from 'form-data'
import { CookieJar } from 'tough-cookie'
import fetchCookie from 'fetch-cookie'
import dotenv from 'dotenv'

// Load local env file if present
const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath })
}

// End-to-end escrow flow script using Supabase Admin REST + cookie jars
// Requirements:
// pnpm add node-fetch form-data tough-cookie fetch-cookie
// Set env vars: SUPABASE_SERVICE_ROLE_KEY and SUPABASE_PROJECT_URL (e.g. your-project.supabase.co)

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
let SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY
let SUPABASE_PROJECT_URL = process.env.SUPABASE_PROJECT_URL || null

// If SUPABASE_PROJECT_URL not provided, try to derive from NEXT_PUBLIC_SUPABASE_URL
if (!SUPABASE_PROJECT_URL && process.env.NEXT_PUBLIC_SUPABASE_URL) {
  SUPABASE_PROJECT_URL = process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

if (!SERVICE_ROLE || !SUPABASE_PROJECT_URL) {
  console.error('Please set SUPABASE_SERVICE_ROLE_KEY (and ensure NEXT_PUBLIC_SUPABASE_URL or SUPABASE_PROJECT_URL is present) in .env.local or environment')
  process.exit(2)
}

const SELLER_EMAIL = process.env.SELLER_EMAIL || `test.seller+${Date.now()}@example.com`
const BUYER_EMAIL = process.env.BUYER_EMAIL || `test.buyer+${Date.now()}@example.com`
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'Password123!'

const sellerJar = new CookieJar()
const buyerJar = new CookieJar()
const sellerFetch = fetchCookie(fetch, sellerJar)
const buyerFetch = fetchCookie(fetch, buyerJar)

async function jsonPost(fetcher, url, body, token) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetcher(url, { method: 'POST', headers, body: JSON.stringify(body) })
  const text = await res.text()
  try { return { status: res.status, body: JSON.parse(text) } } catch { return { status: res.status, body: text } }
}

async function createUserViaSupabaseAdmin(email, password, full_name = '') {
  console.log('Creating user via Supabase Admin REST API:', email)
  const url = `https://${SUPABASE_PROJECT_URL}/auth/v1/admin/users`
  const headers = { 'Content-Type': 'application/json', 'apikey': SERVICE_ROLE, 'Authorization': `Bearer ${SERVICE_ROLE}` }
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email,
      password,
      user_metadata: { full_name },
      // mark as confirmed so we can login via the app without email confirmation step
      email_confirm: true,
      email_confirmed_at: new Date().toISOString(),
    })
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    console.error('Supabase admin create user failed:', res.status, data)
    return null
  }
  return data
}

async function loginWithFetcher(fetcher, email, password) {
  console.log('Logging in', email)
  const url = `${BASE_URL}/api/auth/login`
  const res = await fetcher(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    console.error('Login failed', res.status, data)
    return null
  }
  // login route returns __one_time_token as a convenience and sets cookies
  const token = data?.__one_time_token || null
  return { token, user: data?.user || null }
}

async function createEscrow(fetcher, token, description, price) {
  console.log('Creating escrow...')
  const url = `${BASE_URL}/api/escrow/create`
  const form = new FormData()
  form.append('description', description)
  form.append('price', String(price))
  const headers = form.getHeaders()
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetcher(url, { method: 'POST', headers, body: form })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    console.error('Create escrow failed', res.status, data)
    return null
  }
  return data
}

async function joinEscrow(fetcher, token, code) {
  console.log('Joining escrow with code', code)
  const result = await jsonPost(fetcher, `${BASE_URL}/api/escrow/join`, { code }, token)
  if (result.status !== 200) {
    console.error('Join failed', result.status, result.body)
    return null
  }
  return result.body
}

async function uploadReceipt(fetcher, token, escrowId) {
  console.log('Uploading receipt...')
  const url = `${BASE_URL}/api/escrow/upload-receipt`
  const form = new FormData()
  form.append('escrowId', escrowId)
  const tmpPath = path.join(process.cwd(), 'scripts', 'tmp-receipt.jpg')
  // tiny 1x1 white JPEG (base64)
  const jpegBase64 = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAIBAQEBAQEBAQEBAgICAgQDAgICAQMDBAQEBAQEBQUGBQUFBQYGBgYGBgYICQoKCgoKCg0MDBAQEBAQFBQUFBQU/2wBDAQQEBAQFBQUGBQgHBwoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCv/wAARCAABAAEDAREAAhEBAxEB/8QAFwAAAwEAAAAAAAAAAAAAAAAAAAQGB//EABYBAQEBAAAAAAAAAAAAAAAAAAECA//aAAwDAQACEAMQAAABy//xAAUEQEAAAAAAAAAAAAAAAAAAAAw/9oACAEBAAE/AKf/xAAUEQEAAAAAAAAAAAAAAAAAAAAw/9oACAECAQE/AKf/xAAUEQEAAAAAAAAAAAAAAAAAAAAw/9oACAEDAQE/AKf/2Q=='
  const jpegBuffer = Buffer.from(jpegBase64, 'base64')
  fs.writeFileSync(tmpPath, jpegBuffer)
  form.append('file', fs.createReadStream(tmpPath), { filename: 'receipt.jpg', contentType: 'image/jpeg' })
  const headers = form.getHeaders()
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetcher(url, { method: 'POST', headers, body: form })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    console.error('Upload failed', res.status, data)
    return null
  }
  return data
}

async function postChat(fetcher, token, escrowId, message) {
  const result = await jsonPost(fetcher, `${BASE_URL}/api/escrow/${escrowId}/chat`, { message }, token)
  if (result.status !== 200) {
    console.error('Chat send failed', result.status, result.body)
    return null
  }
  return result.body
}

async function fetchEscrowAdminById(id) {
  const url = `https://${SUPABASE_PROJECT_URL}/rest/v1/escrows?id=eq.${id}&select=*`
  const headers = { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` }
  const res = await fetch(url, { method: 'GET', headers })
  const text = await res.text()
  try { return { status: res.status, body: JSON.parse(text) } } catch { return { status: res.status, body: text } }
}

async function fetchEscrowAsAuthenticated(id, cookieJar) {
  // Try to extract sb:token from the cookie jar for BASE_URL
  const cookies = await new Promise((res) => cookieJar.getCookies(BASE_URL, (e, c) => res(c)))
  const sbTokenCookie = cookies.find(c => c.key === 'sb:token' || c.key === 'sb_token' || c.key === 'sb-token')
  const accessToken = sbTokenCookie ? sbTokenCookie.value : null
  console.log('Extracted access token present?', !!accessToken)
  const url = `https://${SUPABASE_PROJECT_URL}/rest/v1/escrows?select=seller_id,buyer_id&id=eq.${id}`
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const headers = Object.assign({}, accessToken ? { Authorization: `Bearer ${accessToken}` } : {}, anonKey ? { apikey: anonKey } : {})
  const res = await fetch(url, { method: 'GET', headers })
  const text = await res.text()
  try { return { status: res.status, body: JSON.parse(text) } } catch { return { status: res.status, body: text } }
}

async function getChat(fetcher, token, escrowId) {
  const res = await fetcher(`${BASE_URL}/api/escrow/${escrowId}/chat`, { method: 'GET', headers: token ? { Authorization: `Bearer ${token}` } : {} })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    console.error('Get chat failed', res.status, data)
    return null
  }
  return data
}

async function markDelivered(fetcher, token, escrowId) {
  const result = await jsonPost(fetcher, `${BASE_URL}/api/escrow/mark-delivered`, { escrowId }, token)
  if (result.status !== 200) {
    console.error('Mark delivered failed', result.status, result.body)
    return null
  }
  return result.body
}

async function confirmReceived(fetcher, token, escrowId) {
  const result = await jsonPost(fetcher, `${BASE_URL}/api/escrow/confirm-received`, { escrowId }, token)
  if (result.status !== 200) {
    console.error('Confirm received failed', result.status, result.body)
    return null
  }
  return result.body
}

async function adminConfirmPayment(escrowId) {
  const url = `${BASE_URL}/api/admin/confirm-payment`
  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_ROLE}` }
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ escrowId }) })
  const text = await res.text()
  try { return { status: res.status, body: JSON.parse(text) } } catch { return { status: res.status, body: text } }
}

async function assert(condition, message) {
  if (!condition) {
    console.error('Assertion failed:', message)
    process.exit(1)
  }
}

async function main() {
  try {
    // Create test users using Supabase Admin REST API
    const seller = await createUserViaSupabaseAdmin(SELLER_EMAIL, TEST_PASSWORD, 'Script Seller')
    await assert(seller && seller.id, 'Failed to create seller')
    const buyer = await createUserViaSupabaseAdmin(BUYER_EMAIL, TEST_PASSWORD, 'Script Buyer')
    await assert(buyer && buyer.id, 'Failed to create buyer')

  // Login (cookie-aware) - cookies are stored in jars for each user
    const sellerLogin = await loginWithFetcher(sellerFetch, SELLER_EMAIL, TEST_PASSWORD)
    await assert(sellerLogin && (sellerLogin.token || sellerLogin.user), 'Seller login failed')
    const sellerToken = sellerLogin.token

    const buyerLogin = await loginWithFetcher(buyerFetch, BUYER_EMAIL, TEST_PASSWORD)
    await assert(buyerLogin && (buyerLogin.token || buyerLogin.user), 'Buyer login failed')
    const buyerToken = buyerLogin.token

  console.log('Created seller id:', seller.id)
  console.log('Created buyer id:', buyer.id)
  console.log('Seller login user object:', JSON.stringify(sellerLogin.user || {}, null, 2))
  console.log('Buyer login user object:', JSON.stringify(buyerLogin.user || {}, null, 2))

    // Seller creates escrow
    const createResp = await createEscrow(sellerFetch, sellerToken, 'Script product', 500)
    await assert(createResp && createResp.code && createResp.escrowId, 'Create escrow failed or missing code/escrowId')
    const code = createResp.code
    const escrowId = createResp.escrowId

    // Buyer joins by code
    const joinResp = await joinEscrow(buyerFetch, buyerToken, code)
    await assert(joinResp && joinResp.ok, 'Buyer join failed')

  // Debug: fetch escrow via admin REST to confirm buyer_id set
  const adminEscrowAfterJoin = await fetchEscrowAdminById(escrowId)
  console.log('Admin escrow after join:', JSON.stringify(adminEscrowAfterJoin, null, 2))

    // Buyer uploads receipt
    const upload = await uploadReceipt(buyerFetch, buyerToken, escrowId)
    await assert(upload && upload.ok, 'Upload receipt failed')

  // Debug: fetch escrow via admin REST to confirm changes after upload
  const adminEscrowAfterUpload = await fetchEscrowAdminById(escrowId)
  console.log('Admin escrow after upload:', JSON.stringify(adminEscrowAfterUpload, null, 2))

  // For tests: have an admin confirm payment so seller can mark delivered
  const adminConfirm = await adminConfirmPayment(escrowId)
  console.log('Admin confirm payment response:', JSON.stringify(adminConfirm, null, 2))

  // Debug: attempt same query as authenticated user using buyer cookie (no apikey)
  const authEscrowResp = await fetchEscrowAsAuthenticated(escrowId, buyerJar)
  console.log('Authenticated user PostgREST response:', JSON.stringify(authEscrowResp, null, 2))

    // Buyer sends chat
  // Debug: show buyer cookie jar and try GET first to see access/read response
  const buyerCookiesDetailed = await new Promise((res) => buyerJar.getCookies(BASE_URL, (e, c) => res(c)))
  console.log('Buyer cookie jar strings:', buyerCookiesDetailed.map(x => x.cookieString()))
  console.log('Buyer cookie objects:', buyerCookiesDetailed.map(c => ({ key: c.key, domain: c.domain, path: c.path, expires: c.expires, httpOnly: c.httpOnly, secure: c.secure })))
  console.log('Buyer token (one-time or null):', buyerToken)
  // Debug: try GET first to see access/read response
  const getBeforePost = await getChat(buyerFetch, buyerToken, escrowId)
  console.log('GET /chat before POST:', JSON.stringify(getBeforePost, null, 2))
  const chatPost = await postChat(buyerFetch, buyerToken, escrowId, 'Payment sent (script)')
  await assert(chatPost && chatPost.success, 'Buyer chat send failed')

    // Seller fetches chat
    const messages = await getChat(sellerFetch, sellerToken, escrowId)
    await assert(messages && Array.isArray(messages.messages), 'Seller fetch chat failed or invalid format')

    // Seller marks delivered
    const mark = await markDelivered(sellerFetch, sellerToken, escrowId)
    await assert(mark && mark.ok, 'Mark delivered failed')

    // Buyer confirms received
    const confirm = await confirmReceived(buyerFetch, buyerToken, escrowId)
    await assert(confirm && confirm.ok, 'Confirm received failed')

    console.log('E2E script succeeded')
    process.exit(0)
  } catch (err) {
    console.error('Script failed', err)
    process.exit(1)
  }
}

main()
