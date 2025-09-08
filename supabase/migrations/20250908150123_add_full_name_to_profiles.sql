-- Add full_name column to profiles table
alter table profiles add column if not exists full_name text;
