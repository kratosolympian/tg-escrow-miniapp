import fetch from 'node-fetch'

async function postAssign(email, action) {
  const url = 'http://localhost:3000/api/admin/assign-role'
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, action })
  })
  const text = await res.text()
  return { status: res.status, body: text }
}

async function fetchList() {
  const url = 'http://localhost:3000/api/admin/super-admin-manage'
  const res = await fetch(url)
  const json = await res.json()
  return { status: res.status, body: json }
}

async function main() {
  const email = 'johnayodele01@gmail.com'
  console.log('Adding admin for', email)
  const add = await postAssign(email, 'add')
  console.log('Add response:', add.status, add.body)

  console.log('Fetching admin list...')
  const list1 = await fetchList()
  console.log('List status:', list1.status, JSON.stringify(list1.body, null, 2))

  console.log('Removing admin for', email)
  const rem = await postAssign(email, 'remove')
  console.log('Remove response:', rem.status, rem.body)

  console.log('Fetching admin list again...')
  const list2 = await fetchList()
  console.log('List status:', list2.status, JSON.stringify(list2.body, null, 2))
}

main().catch(err => { console.error(err); process.exit(1) })
