import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabaseServer'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceRoleClient()

    console.log('Applying one-time token fixes...')

    // Create the RPC function
    const rpcSql = `
      CREATE OR REPLACE FUNCTION public.consume_one_time_token(p_id uuid)
      RETURNS text LANGUAGE plpgsql AS $$
      DECLARE
        v_user_id text;
      BEGIN
        DELETE FROM one_time_tokens
        WHERE id = p_id
        AND expires_at > now()
        RETURNING user_id INTO v_user_id;
        RETURN v_user_id;
      END;
      $$;
    `

    // Add RLS policy
    const rlsSql = `
      DROP POLICY IF EXISTS "service role all tokens" ON one_time_tokens;
      CREATE POLICY "service role all tokens" ON one_time_tokens FOR ALL USING (auth.role() = 'service_role');
      GRANT EXECUTE ON FUNCTION public.consume_one_time_token(uuid) TO authenticated;
    `

    // Execute the SQL
    try {
      // Try to execute via RPC if available
      await supabase.rpc('exec_sql', { sql: rpcSql + rlsSql })
    } catch (rpcError) {
      console.warn('RPC execution failed, trying direct approach')
      // If RPC doesn't work, we'll need manual application
      return NextResponse.json({
        error: 'Cannot apply fixes automatically',
        message: 'Please run the following SQL in your Supabase SQL Editor:',
        sql: rpcSql + rlsSql
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'One-time token fixes applied successfully'
    })

  } catch (error) {
    console.error('Fix application error:', error)
    return NextResponse.json({
      error: 'Failed to apply fixes',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}