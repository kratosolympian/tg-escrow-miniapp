-- Up: create one_time_tokens table for cross-process token consumption
CREATE TABLE IF NOT EXISTS one_time_tokens (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Down: drop table
-- DROP TABLE IF EXISTS one_time_tokens;
