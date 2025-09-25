-- Migration: create expire_escrows function and schedule it if pg_cron is available
-- This function moves escrows from waiting_payment -> closed when expires_at has passed
-- It also inserts a status_log row for each closed escrow.

BEGIN;

-- Create the function
CREATE OR REPLACE FUNCTION public.expire_escrows()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
BEGIN
  WITH expired AS (
    SELECT id FROM escrows
    WHERE (status = 'created' OR status = 'waiting_payment') 
    AND expires_at IS NOT NULL AND expires_at < now()
  )
  -- Update statuses
  UPDATE escrows
  SET status = 'closed', updated_at = now()
  WHERE id IN (SELECT id FROM expired);

  -- Insert status logs for closed escrows
  INSERT INTO status_logs (escrow_id, status, changed_by, created_at)
  SELECT id, 'closed', NULL, now()
  FROM expired;

  RETURN;
END;
$$;

-- Try to create pg_cron extension and schedule the job. If pg_cron is not available this will be a no-op.
DO $$
BEGIN
  -- attempt to create extension if allowed
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'pg_cron extension not available or not permitted in this DB, skipping creation.';
  END;

  -- If pg_cron is available, schedule the expire_escrows function every minute
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.schedule('expire_escrows_every_min', '*/1 * * * *', 'SELECT public.expire_escrows();');
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Failed to schedule expire_escrows job via pg_cron; you may schedule it manually in Supabase.';
    END;
  ELSE
    RAISE NOTICE 'pg_cron not present; expire_escrows created but not scheduled.';
  END IF;
END$$;

COMMIT;

-- Usage:
-- If pg_cron is not available in your Supabase project, call the function manually via SQL or wire it into Supabase scheduled functions:
-- SELECT public.expire_escrows();
