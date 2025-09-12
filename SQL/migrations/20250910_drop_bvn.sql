-- Migration: drop bvn column from profiles
-- Up: remove column
ALTER TABLE profiles DROP COLUMN IF EXISTS bvn;

-- Down: add the column back if needed (nullable text)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bvn text;
