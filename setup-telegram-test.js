import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setupTelegramForTesting() {
  console.log('🔧 Setting up Telegram IDs for testing...\n');

  // Get all profiles
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, full_name, telegram_id, role')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching profiles:', error);
    return;
  }

  console.log('📋 Current profiles:');
  profiles.forEach((profile, i) => {
    console.log(`${i+1}. ${profile.full_name || 'No name'} (${profile.role})`);
    console.log(`   ID: ${profile.id}`);
    console.log(`   Telegram ID: ${profile.telegram_id || '❌ NOT SET'}`);
    console.log('');
  });

  // Assign test Telegram IDs
  const testTelegramIds = [
    '123456789', // Test ID 1
    '987654321', // Test ID 2
    '555666777', // Test ID 3
  ];

  let idIndex = 0;
  for (const profile of profiles) {
    if (!profile.telegram_id && idIndex < testTelegramIds.length) {
      const testId = testTelegramIds[idIndex];

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          telegram_id: testId,
          updated_at: new Date().toISOString()
        })
        .eq('id', profile.id);

      if (updateError) {
        console.error(`❌ Failed to update ${profile.full_name}:`, updateError);
      } else {
        console.log(`✅ Assigned Telegram ID ${testId} to ${profile.full_name} (${profile.role})`);
      }

      idIndex++;
    }
  }

  console.log('\n🎉 Setup complete!');
  console.log('📱 Test Telegram IDs assigned. Now all users should receive notifications.');
  console.log('🧪 Test the notifications at: http://localhost:3000/api/test-notifications');

  // Show final state
  console.log('\n📊 Final state:');
  const { data: updatedProfiles } = await supabase
    .from('profiles')
    .select('full_name, role, telegram_id')
    .order('created_at', { ascending: false });

  updatedProfiles.forEach(profile => {
    console.log(`- ${profile.full_name} (${profile.role}): ${profile.telegram_id || '❌ NOT SET'}`);
  });
}

setupTelegramForTesting().catch(console.error);