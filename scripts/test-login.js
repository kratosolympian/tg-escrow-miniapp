// Test script: POST form to /api/auth/login, capture Set-Cookie and redirect, then fetch /admin/dashboard
import fetch from 'node-fetch'

async function main() {
  const url = 'http://localhost:3000/api/auth/login'
  const params = new URLSearchParams()
  params.append('email', 'ceo@kratos.ng')
  params.append('password', 'letmein')

  console.log('Posting login form...')
  const res = await fetch(url, {
    method: 'POST',
    body: params,
    redirect: 'manual'
  })

  console.log('Status:', res.status)
  const setCookie = res.headers.get('set-cookie')
  const location = res.headers.get('location')
  console.log('set-cookie:', setCookie)
  console.log('location:', location)

  if (setCookie) {
    const cookie = setCookie.split(';')[0]
    console.log('Using cookie:', cookie)

    if (location) {
      const followUrl = location.startsWith('http') ? location : 'http://localhost:3000' + location
      const follow = await fetch(followUrl, { headers: { Cookie: cookie } })
      console.log('Follow redirect status:', follow.status)
      const followText = await follow.text()
      console.log('Follow redirect body snippet:', followText.slice(0, 200))
    }

    const dash = await fetch('http://localhost:3000/admin/dashboard', { headers: { Cookie: cookie } })
    console.log('Dashboard fetch status:', dash.status)
    const dashText = await dash.text()
    console.log('Dashboard body snippet:', dashText.slice(0, 300))
  } else {
    const text = await res.text()
    console.log('No set-cookie header; response body:', text.slice(0, 500))
  }
}

main().catch(err => { console.error(err); process.exit(1) })
