-- Add admin presence and escrow assignment + expiry

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_online boolean DEFAULT false;

ALTER TABLE escrows
  ADD COLUMN IF NOT EXISTS assigned_admin_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone;

-- Note: run this migration in your Supabase DB environment to apply these schema changes.
