-- Migration: Remove permanent role and telegram_id constraints for session-based system
-- This allows users to have flexible roles and multiple telegram accounts

-- Remove unique constraint on telegram_id to allow multiple telegram accounts per user
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_telegram_id_key;

-- Make role nullable and remove default - roles will be session-based
ALTER TABLE profiles ALTER COLUMN role DROP DEFAULT;
ALTER TABLE profiles ALTER COLUMN role DROP NOT NULL;

-- Add a comment explaining the new approach
COMMENT ON COLUMN profiles.role IS 'Legacy field - roles are now session-based. This may be removed in future migrations.';
COMMENT ON COLUMN profiles.telegram_id IS 'Legacy field - telegram linking is now session-based. This may be removed in future migrations.';