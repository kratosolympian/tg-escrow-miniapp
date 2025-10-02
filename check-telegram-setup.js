import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkProfiles() {
  console.log('🔍 Checking profiles for Telegram IDs...\n');

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, telegram_id, role')
    .limit(10);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('📋 Profiles found:');
  data.forEach((profile, i) => {
    console.log(`${i+1}. ${profile.full_name || 'No name'} (${profile.role})`);
    console.log(`   ID: ${profile.id}`);
    console.log(`   Telegram ID: ${profile.telegram_id || '❌ Not set'}`);
    console.log('');
  });

  // Check for escrows
  const { data: escrows, error: escrowError } = await supabase
    .from('escrows')
    .select(`
      id,
      code,
      status,
      seller:profiles!seller_id(full_name, telegram_id),
      buyer:profiles!buyer_id(full_name, telegram_id)
    `)
    .limit(5);

  if (escrowError) {
    console.error('❌ Error fetching escrows:', escrowError);
    return;
  }

  console.log('📦 Recent escrows:');
  escrows.forEach((escrow, i) => {
    console.log(`${i+1}. ${escrow.code} - Status: ${escrow.status}`);
    console.log(`   Seller: ${escrow.seller?.full_name || 'N/A'} (TG: ${escrow.seller?.telegram_id || '❌ Not set'})`);
    console.log(`   Buyer: ${escrow.buyer?.full_name || 'N/A'} (TG: ${escrow.buyer?.telegram_id || '❌ Not set'})`);
    console.log('');
  });

  // Summary
  const profilesWithTelegram = data.filter(p => p.telegram_id);
  const escrowsWithTelegram = escrows.filter(e => e.seller?.telegram_id || e.buyer?.telegram_id);

  console.log('📊 Summary:');
  console.log(`- Total profiles: ${data.length}`);
  console.log(`- Profiles with Telegram ID: ${profilesWithTelegram.length}`);
  console.log(`- Escrows with Telegram recipients: ${escrowsWithTelegram.length}`);

  if (profilesWithTelegram.length === 0) {
    console.log('\n⚠️  No users have Telegram IDs set up for notifications!');
    console.log('To test notifications:');
    console.log('1. Use the Telegram auth flow to associate Telegram IDs with user accounts');
    console.log('2. Or manually set telegram_id in the profiles table for testing');
  } else {
    console.log('\n✅ Ready to test notifications!');
    console.log('Visit: http://localhost:3000/api/test-notifications');
  }
}

checkProfiles().catch(console.error);