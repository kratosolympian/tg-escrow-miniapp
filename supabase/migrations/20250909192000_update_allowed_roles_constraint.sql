-- Migration: Ensure profiles.role allows 'seller' and normalize existing rows
-- Run this in your Supabase project (or via migrations runner)

BEGIN;

-- Normalize any invalid or NULL roles before enforcing the constraint
UPDATE public.profiles
SET role = 'buyer'
WHERE role IS NULL OR role NOT IN ('buyer','seller','admin');

-- Replace existing constraint (if one exists) with a constraint that permits 'seller'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS allowed_roles;
ALTER TABLE public.profiles
  ADD CONSTRAINT allowed_roles CHECK (role IN ('buyer','seller','admin'));

COMMIT;
