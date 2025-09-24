-- Add updated_at column to escrows table if missing
-- This is needed for the set_updated_at trigger

ALTER TABLE escrows ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- Ensure the trigger exists
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS escrows_set_updated ON escrows;
CREATE TRIGGER escrows_set_updated
  BEFORE UPDATE ON escrows
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();