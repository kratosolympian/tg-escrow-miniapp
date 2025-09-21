-- Add online status column to profiles table for admin online/offline toggle
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS online boolean DEFAULT false;

-- Optionally, set all current admins to offline by default
UPDATE profiles SET online = false WHERE role = 'admin' OR role = 'super_admin';
