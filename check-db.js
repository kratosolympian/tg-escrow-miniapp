import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  try {
    const envContent = fs.readFileSync('.env.local', 'utf8');
    const lines = envContent.split('\n');
    for (const line of lines) {
      const [key, value] = line.split('=');
      if (key === 'NEXT_PUBLIC_SUPABASE_URL') supabaseUrl = value;
      if (key === 'SUPABASE_SERVICE_ROLE_KEY') serviceKey = value;
    }
  } catch (error) {
    console.error('Could not read .env.local file');
  }
}

if (!supabaseUrl || !serviceKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function checkDatabase() {
  try {
    console.log('Checking database tables...');

    // Check one_time_tokens table
    const tokensResult = await supabase.from('one_time_tokens').select('*').limit(1);
    console.log('one_time_tokens table exists:', !tokensResult.error);
    if (tokensResult.error) {
      console.log('Error:', tokensResult.error.message);
    }

    // Check if consume_one_time_token function exists
    try {
      const rpcResult = await supabase.rpc('consume_one_time_token', { p_id: '00000000-0000-0000-0000-000000000000' });
      console.log('consume_one_time_token RPC exists:', !rpcResult.error);
    } catch (rpcError) {
      console.log('consume_one_time_token RPC error:', rpcError.message);
    }

    // Check profiles table
    const profilesResult = await supabase.from('profiles').select('*').limit(1);
    console.log('profiles table exists:', !profilesResult.error);
    if (profilesResult.error) {
      console.log('Profiles error:', profilesResult.error.message);
    }

  } catch (error) {
    console.error('Database check failed:', error);
  }
}

checkDatabase();