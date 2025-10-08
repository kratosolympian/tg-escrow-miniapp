-- Fix the expire_escrows function to properly handle CTE scope
-- This fixes the "relation 'expired' does not exist" error in pg_cron
-- Run this in Supabase SQL editor

CREATE OR REPLACE FUNCTION public.expire_escrows()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
BEGIN
  -- Update statuses and insert status logs in one go using a CTE
  WITH expired AS (
    SELECT id FROM escrows
    WHERE (status = 'created' OR status = 'waiting_payment')
    AND expires_at IS NOT NULL AND expires_at < now()
  ),
  updated_escrows AS (
    UPDATE escrows
    SET status = 'closed', updated_at = now()
    WHERE id IN (SELECT id FROM expired)
    RETURNING id
  )
  -- Insert status logs for closed escrows
  INSERT INTO status_logs (escrow_id, status, changed_by, created_at)
  SELECT id, 'closed', NULL, now()
  FROM updated_escrows;

  RETURN;
END;
$$;

-- Set proper search path for the function
ALTER FUNCTION public.expire_escrows() SET search_path = 'public';