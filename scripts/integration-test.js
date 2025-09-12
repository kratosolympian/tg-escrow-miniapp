// Integration test script: signup/login/create/join flows using test accounts
// Usage: node scripts/integration-test.js

const fetch = require('node-fetch')
const FormData = require('form-data')
const fs = require('fs')

const BASE = process.env.BASE_URL || 'http://localhost:3000'

async function postJson(path, body, includeCreds = false, cookies = null) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    redirect: 'manual'
  })
  return res
}

async function signupOrGetToken(email, password, name) {
  const res = await fetch(BASE + '/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
    redirect: 'manual'
  })
  const json = await res.json().catch(() => null)
  return { res, json }
}

async function loginForm(email, password) {
  const params = new URLSearchParams()
  params.append('email', email)
  params.append('password', password)

  const res = await fetch(BASE + '/api/auth/login', {
    method: 'POST',
    body: params,
    redirect: 'manual'
  })
  return res
}

async function httpGetWithCookie(path, cookie) {
  const res = await fetch(BASE + path, { headers: { Cookie: cookie } })
  return res
}

async function createEscrowWithCookie(cookie, description, price) {
  const fd = new FormData()
  fd.append('description', description)
  fd.append('price', price)
  // attach a small placeholder image if available
  if (fs.existsSync('test-assets/sample.jpg')) {
    fd.append('image', fs.createReadStream('test-assets/sample.jpg'))
  }
  const res = await fetch(BASE + '/api/escrow/create', { method: 'POST', body: fd, headers: { Cookie: cookie } })
  return res
}

async function main() {
  console.log('Starting integration test')

  // Ensure test accounts: buyer and seller
  const buyer = { email: 'buy@kratos.ng', password: 'letmein', name: 'Buyer Test' }
  const seller = { email: 'sell@kratos.ng', password: 'letmein', name: 'Seller Test' }

  console.log('Signing up seller...')
  const s1 = await signupOrGetToken(seller.email, seller.password, seller.name)
  console.log('Seller signup status:', s1.res.status, s1.json)

  console.log('Signing up buyer...')
  const b1 = await signupOrGetToken(buyer.email, buyer.password, buyer.name)
  console.log('Buyer signup status:', b1.res.status, b1.json)

  // Login seller using form to capture cookie and create escrow
  console.log('Logging in seller via form...')
  const loginRes = await loginForm(seller.email, seller.password)
  console.log('Login status:', loginRes.status)
  const setCookie = loginRes.headers.get('set-cookie')
  if (!setCookie) {
    console.error('No set-cookie header from login; aborting')
    process.exit(2)
  }
  const cookie = setCookie.split(';')[0]
  console.log('Captured cookie:', cookie)

  console.log('Creating escrow as seller...')
  const createRes = await createEscrowWithCookie(cookie, 'Test product', '1000')
  const createJson = await createRes.json().catch(() => null)
  console.log('Create status:', createRes.status, createJson)
  if (!createJson || !createJson.code) {
    console.error('Escrow creation failed')
    process.exit(3)
  }

  const code = createJson.code
  console.log('Escrow code:', code)

  // Now buyer joins flow: login via fetch (client) or signup path
  console.log('Buyer attempting to join using code')
  // Attempt join — this should trigger auth prompt from server (401) first
  const joinResp = await fetch(BASE + '/api/escrow/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
    redirect: 'manual'
  })
  console.log('Join status (unauthenticated):', joinResp.status)

  // Now login buyer via JSON fetch to get session cookie (the login endpoint returns JSON for fetch)
  console.log('Logging in buyer via JSON fetch...')
  const loginFetchResp = await fetch(BASE + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: buyer.email, password: buyer.password }),
    redirect: 'manual'
  })
  const loginFetchJson = await loginFetchResp.json().catch(() => null)
  console.log('Login fetch status:', loginFetchResp.status, loginFetchJson)

  // After JSON login, do join with credentials included
  const joinWithCreds = await fetch(BASE + '/api/escrow/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
    credentials: 'include',
    redirect: 'manual'
  })
  console.log('Join after auth status:', joinWithCreds.status)
  const joinJson = await joinWithCreds.json().catch(() => null)
  console.log('Join response:', joinJson)

  if (joinWithCreds.ok) {
    console.log('Integration test succeeded')
    process.exit(0)
  } else {
    console.error('Integration test failed at join step')
    process.exit(4)
  }
}

main().catch(err => { console.error(err); process.exit(1) })
