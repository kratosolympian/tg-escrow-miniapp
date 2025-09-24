-- Add the missing 'email' column to the 'profiles' table
ALTER TABLE public.profiles ADD COLUMN email TEXT;