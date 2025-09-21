import { createServiceRoleClient } from '../lib/supabaseServer'

async function seed() {
  const supabase = createServiceRoleClient()

  const code = 'DEMO123'

  // Check if already exists
  const { data: existing, error: fetchErr } = await supabase
    .from('escrows')
    .select('*')
    .eq('code', code)
    .limit(1)
    .single()

  if (fetchErr && fetchErr.code !== 'PGRST116') {
    console.error('Failed to check existing escrow:', fetchErr)
    process.exit(1)
  }

  if (existing) {
    console.log('Escrow already exists:', existing)
    return
  }

  const now = new Date().toISOString()
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString() // 24h

  const insertPayload = {
    code,
    price: 1000,
    description: 'Demo escrow for E2E testing',
    status: 'waiting_payment',
    created_at: now,
    expires_at: expires,
    // seller and assigned admin can be left null; buyer_id null
    admin_fee: 0
  }

  const { data, error } = await supabase.from('escrows').insert([insertPayload]).select().single()

  if (error) {
    console.error('Insert error:', error)
    process.exit(1)
  }

  console.log('Inserted escrow:', data)
}

seed().catch((e) => {
  console.error(e)
  process.exit(1)
})
