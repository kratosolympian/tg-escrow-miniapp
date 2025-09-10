import fetch from 'node-fetch'

async function main() {
  const url = 'http://localhost:3000/api/admin/assign-role'
  const body = { email: 'testadmin@example.com', action: 'add' }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  console.log('Status:', res.status)
  const text = await res.text()
  console.log('Body:', text)
}

main().catch(err => { console.error(err); process.exit(1) })
