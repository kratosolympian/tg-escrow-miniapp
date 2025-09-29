import fetch from 'node-fetch'
import fetchCookie from 'fetch-cookie'
import { CookieJar } from 'tough-cookie'
import FormData from 'form-data'
import fs from 'fs'
import path from 'path'

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

async function uploadReceipt(escrowId) {
  const url = `${BASE}/api/escrow/upload-receipt`
  const tmpPath = path.join(process.cwd(), 'scripts', 'tmp-receipt.jpg')
  const jpegBase64 = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAIBAQEBAQEBAQEBAgICAgQDAgICAQMDBAQEBAQEBQUGBQUFBQYGBgYGBgYICQoKCgoKCg0MDBAQEBAQFBQUFBQU/2wBDAQQEBAQFBQUGBQgHBwoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCv/wAARCAABAAEDAREAAhEBAxEB/8QAFwAAAwEAAAAAAAAAAAAAAAAAAAQGB//EABYBAQEBAAAAAAAAAAAAAAAAAAECA//aAAwDAQACEAMQAAABy//xAAUEQEAAAAAAAAAAAAAAAAAAAAw/9oACAEBAAE/AKf/xAAUEQEAAAAAAAAAAAAAAAAAAAAw/9oACAECAQE/AKf/xAAUEQEAAAAAAAAAAAAAAAAAAAAw/9oACAEDAQE/AKf/2Q=='
  const jpegBuffer = Buffer.from(jpegBase64, 'base64')
  fs.writeFileSync(tmpPath, jpegBuffer)
  const form = new FormData()
  form.append('escrowId', escrowId)
  form.append('file', fs.createReadStream(tmpPath), { filename: 'receipt.jpg', contentType: 'image/jpeg' })
  const headers = form.getHeaders()
  const res = await cookieFetch(url, { method: 'POST', headers, body: form })
  const text = await res.text().catch(() => null)
  try { return { ok: res.ok, status: res.status, body: JSON.parse(text) } } catch { return { ok: res.ok, status: res.status, body: text } }
}

async function fetchEscrow(code) {
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

  // fetch escrow to get id
  const escrowResp = await fetchEscrow(code)
  console.log('Escrow fetch status', escrowResp.status)
  if (!escrowResp.ok) {
    console.error('Escrow fetch failed', escrowResp.body)
    process.exit(1)
  }
  const escrowId = escrowResp.body?.escrow?.id
  if (!escrowId) {
    console.error('Escrow id not found')
    process.exit(1)
  }

  console.log('Uploading receipt for escrow id', escrowId)
  const upload = await uploadReceipt(escrowId)
  console.log('Upload result', upload.status, upload.body)
  if (!upload.ok) {
    console.error('Upload failed')
    process.exit(1)
  }

  // fetch escrow again and expect receipts non-empty
  const after = await fetchEscrow(code)
  if (!after.ok) {
    console.error('Post-upload escrow fetch failed', after.body)
    process.exit(1)
  }
  const receipts = after.body?.escrow?.receipts || []
  console.log('Receipts count after upload', receipts.length)
  if (receipts.length > 0) {
    console.log('Dev upload test succeeded')
    process.exit(0)
  }
  console.error('No receipts found after upload')
  process.exit(2)
}

main().catch(e => { console.error(e); process.exit(1) })
