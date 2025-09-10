import fetch from 'node-fetch'

async function main() {
  const url = 'http://localhost:3000/api/admin/setup-super-admin'
  const res = await fetch(url, { method: 'POST', redirect: 'manual' })
  console.log('Status:', res.status)
  const text = await res.text()
  console.log('Body:', text)
}

main().catch(err => { console.error(err); process.exit(1) })
