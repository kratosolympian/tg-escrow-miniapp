import fetch from 'node-fetch'

const BASE = process.env.BASE_URL || 'http://localhost:3000'

async function run() {
  try {
    console.log('Requesting generated token...')
    const genRes = await fetch(`${BASE}/api/test?generateToken=1&role=seller`)
    const genJson = await genRes.json()
    console.log('generate response:', genRes.status, genJson)
    const token = genJson.token
    if (!token) {
      console.error('No token returned')
      process.exit(1)
    }
    console.log('Posting token to verify endpoint...')
    const postRes = await fetch(`${BASE}/api/test`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
    const postJson = await postRes.json()
    console.log('verify response:', postRes.status, postJson)
    process.exit(0)
  } catch (e) {
    console.error('Error:', e)
    process.exit(1)
  }
}

run()
