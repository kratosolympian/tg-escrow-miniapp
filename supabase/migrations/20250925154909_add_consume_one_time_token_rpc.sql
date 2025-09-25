-- Migration: Add consume_one_time_token RPC function
-- This function atomically consumes a one-time token and returns the user_id

BEGIN;

-- Create the RPC function to consume one-time tokens
CREATE OR REPLACE FUNCTION public.consume_one_time_token(p_id uuid)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v_user_id text;
BEGIN
  -- Atomically select and delete the token
  DELETE FROM one_time_tokens
  WHERE id = p_id
  AND expires_at > now()
  RETURNING user_id INTO v_user_id;

  -- Return the user_id if found, otherwise null
  RETURN v_user_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.consume_one_time_token(uuid) TO authenticated;

COMMIT;