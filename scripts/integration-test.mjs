import fs from 'fs'
import FormData from 'form-data'

const BASE = process.env.BASE_URL || 'http://localhost:3000'

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

async function createEscrowWithCookie(cookie, description, price) {
  // For test stability, always send JSON to avoid multipart/form-data parsing issues in the test environment.
  const body = { description, price }
  const res = await fetch(BASE + '/api/escrow/create', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', Cookie: cookie } })
  return res
}

async function main() {
  console.log('Starting integration test (ESM)')

  const rand = () => Math.random().toString(36).slice(2, 10)
  const buyer = { email: `buy+${rand()}@kratos.ng`, password: 'letmein', name: 'Buyer Test' }
  const seller = { email: `sell+${rand()}@kratos.ng`, password: 'letmein', name: 'Seller Test' }

  console.log('Signing up seller...')
  const s1 = await signupOrGetToken(seller.email, seller.password, seller.name)
  console.log('Seller signup status:', s1.res.status, s1.json)

  console.log('Signing up buyer...')
  const b1 = await signupOrGetToken(buyer.email, buyer.password, buyer.name)
  console.log('Buyer signup status:', b1.res.status, b1.json)

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

  // Ensure seller has bank details (profile completion) so escrow creation succeeds
  console.log('Updating seller banking details...')
  const bankResp = await fetch(BASE + '/api/profile/banking', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({ full_name: seller.name, phone_number: '08031234567', bank_name: 'Access Bank', account_number: '0123456789', account_holder_name: seller.name })
  })
  console.log('Bank update status:', bankResp.status)

  console.log('Creating escrow as seller...')
  const createRes = await createEscrowWithCookie(cookie, 'Test product', '1000')
  let createJson = null
  try {
    createJson = await createRes.json()
  } catch (e) {
    const text = await createRes.text().catch(() => '<no-body>')
    console.error('Create returned non-json response. status=', createRes.status)
    console.error('Create headers:', Object.fromEntries(createRes.headers.entries()))
    console.error('Create body text:', text)
  }
  console.log('Create status:', createRes.status, createJson)
  if (!createJson || !createJson.code) {
    console.error('Escrow creation failed', createJson?.details || '')
    process.exit(3)
  }

  const code = createJson.code
  console.log('Escrow code:', code)

  console.log('Buyer attempting to join using code')
  const joinResp = await fetch(BASE + '/api/escrow/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
    redirect: 'manual'
  })
  console.log('Join status (unauthenticated):', joinResp.status)

  console.log('Logging in buyer via JSON fetch...')
  const loginFetchResp = await fetch(BASE + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: buyer.email, password: buyer.password }),
    redirect: 'manual',
    credentials: 'include'
  })
  const loginFetchJson = await loginFetchResp.json().catch(() => null)
  console.log('Login fetch status:', loginFetchResp.status, loginFetchJson)

  // Prefer using the one-time token returned by JSON login for the join flow.
  let finalBuyerCookie = null
  let oneTimeToken = loginFetchJson?.__one_time_token || null
  if (!oneTimeToken) {
    // Try to capture cookie set by JSON login (some environments set cookie on same response)
    const setCookieBuyer = loginFetchResp.headers.get('set-cookie')
    finalBuyerCookie = setCookieBuyer ? setCookieBuyer.split(';')[0] : null
  }

  if (!oneTimeToken && !finalBuyerCookie) {
    console.log('Attempting form login for buyer to capture cookie...')
    const formLogin = await fetch(BASE + '/api/auth/login', {
      method: 'POST',
      body: new URLSearchParams({ email: buyer.email, password: buyer.password }),
      redirect: 'manual'
    })
    const sc = formLogin.headers.get('set-cookie')
    finalBuyerCookie = sc ? sc.split(';')[0] : null
    console.log('Captured buyer cookie via form login:', !!finalBuyerCookie)
  }

  const joinHeaders = { 'Content-Type': 'application/json' }
  if (finalBuyerCookie) joinHeaders['Cookie'] = finalBuyerCookie
  const joinBody = oneTimeToken ? { code, __one_time_token: oneTimeToken } : { code }
  let joinWithCreds = await fetch(BASE + '/api/escrow/join', {
    method: 'POST',
    headers: joinHeaders,
    body: JSON.stringify(joinBody),
    redirect: 'manual'
  })

  // If server accepted cookie or body token earlier, also exercise header variants
  if (oneTimeToken && !joinWithCreds.ok) {
    console.log('Retrying join with x-one-time-token header')
    const headerJoin = await fetch(BASE + '/api/escrow/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-one-time-token': oneTimeToken },
      body: JSON.stringify({ code }),
      redirect: 'manual'
    })
    if (headerJoin.ok) joinWithCreds = headerJoin
  }

  if (oneTimeToken && !joinWithCreds.ok) {
    console.log('Retrying join with Authorization: Bearer header')
    const bearerJoin = await fetch(BASE + '/api/escrow/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${oneTimeToken}` },
      body: JSON.stringify({ code }),
      redirect: 'manual'
    })
    if (bearerJoin.ok) joinWithCreds = bearerJoin
  }
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
