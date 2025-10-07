import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabaseServer";

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceRoleClient();

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
    `;

    // Add RLS policy
    const rlsSql = `
      DROP POLICY IF EXISTS "service role all tokens" ON one_time_tokens;
      CREATE POLICY "service role all tokens" ON one_time_tokens FOR ALL USING (auth.role() = 'service_role');
      GRANT EXECUTE ON FUNCTION public.consume_one_time_token(uuid) TO authenticated;
    `;

    // Return SQL for manual execution since exec_sql RPC doesn't exist
    return NextResponse.json(
      {
        error: "Manual SQL execution required",
        message: "Please run the following SQL in your Supabase SQL Editor:",
        sql: rpcSql + rlsSql,
      },
      { status: 200 },
    );

    return NextResponse.json(
      {
        error: "Manual SQL execution required",
        message: "Please run the following SQL in your Supabase SQL Editor:",
        sql: rpcSql + rlsSql,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Fix application error:", error);
    return NextResponse.json(
      {
        error: "Failed to apply fixes",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
