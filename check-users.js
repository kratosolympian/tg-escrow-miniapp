import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkUsersAndEscrows() {
  console.log('🔍 Checking existing users and escrows...\n');

  // Get profiles
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, telegram_id, role')
    .order('created_at', { ascending: false });

  if (profileError) {
    console.error('❌ Error fetching profiles:', profileError);
    return;
  }

  console.log('👥 User Profiles:');
  profiles.forEach((profile, i) => {
    console.log(`${i+1}. ${profile.full_name || 'No name'} (${profile.role}) - ID: ${profile.id}`);
    console.log(`   Telegram ID: ${profile.telegram_id || '❌ NOT SET'}`);
  });

  // Get escrows
  const { data: escrows, error: escrowError } = await supabase
    .from('escrows')
    .select('id, code, seller_id, buyer_id, status')
    .limit(5);

  if (escrowError) {
    console.error('❌ Error fetching escrows:', escrowError);
    return;
  }

  console.log('\n📦 Recent Escrows:');
  escrows.forEach((escrow, i) => {
    const seller = profiles.find(p => p.id === escrow.seller_id);
    const buyer = profiles.find(p => p.id === escrow.buyer_id);
    console.log(`${i+1}. ${escrow.code} - Status: ${escrow.status}`);
    console.log(`   Seller: ${seller?.full_name || 'Unknown'} (TG: ${seller?.telegram_id || '❌'})`);
    console.log(`   Buyer: ${buyer?.full_name || 'No buyer'} (TG: ${buyer?.telegram_id || '❌'})`);
  });

  // Summary
  const sellers = profiles.filter(p => p.role === 'seller');
  const buyers = profiles.filter(p => p.role === 'buyer');
  const admins = profiles.filter(p => p.role === 'admin');

  console.log('\n📊 Summary:');
  console.log(`- Total profiles: ${profiles.length}`);
  console.log(`- Sellers: ${sellers.length} (${sellers.filter(s => s.telegram_id).length} with Telegram)`);
  console.log(`- Buyers: ${buyers.length} (${buyers.filter(b => b.telegram_id).length} with Telegram)`);
  console.log(`- Admins: ${admins.length} (${admins.filter(a => a.telegram_id).length} with Telegram)`);

  if (escrows.length > 0) {
    console.log('\n💡 To set up Telegram notifications for seller/buyer:');
    console.log('1. Choose a seller and buyer from the list above');
    console.log('2. Get their Telegram user IDs (from Telegram WebApp or manually)');
    console.log('3. Update their profiles with the Telegram IDs');
  }
}

checkUsersAndEscrows().catch(console.error);