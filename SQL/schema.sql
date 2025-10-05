-- Enable required extensions
create extension if not exists pgcrypto;

-- Profiles mirror a-- Chat participants (to track who has access to chat)
create table if not exists chat_participants (
  id uuid primary key default gen_random_uuid(),
  escrow_id uuid not null references escrows(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  last_read_at timestamp with time zone default now(),
  created_at timestamp with time zone default now(),
  unique(escrow_id, user_id)
);

-- User notifications for real-time status updates
create table if not exists user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  escrow_id uuid not null references escrows(id) on delete cascade,
  title text not null,
  message text not null,
  type text check (type in ('info', 'success', 'warning', 'error')) default 'info',
  action_text text,
  escrow_code text,
  is_read boolean default false,
  created_at timestamp with time zone default now()
);

-- Indexes for performance
create index if not exists idx_user_notifications_user_id on user_notifications(user_id);
create index if not exists idx_user_notifications_created_at on user_notifications(created_at desc);
create index if not exists idx_user_notifications_unread on user_notifications(user_id, is_read) where is_read = false;

-- Profiles table - hold telegram mapping + role + banking info
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  telegram_id text unique,
  role text check (role in ('buyer','seller','admin')) default 'buyer',
  -- Banking information for payments/refunds
  bank_name text,
  account_number text,
  account_holder_name text,
  phone_number text,
  -- Profile completion tracking
  profile_completed boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Core escrows
create table if not exists escrows (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  seller_id uuid not null references profiles(id) on delete cascade,
  buyer_id uuid references profiles(id) on delete set null,
  description text not null,
  price numeric(12,2) not null check (price >= 0),
  admin_fee numeric(12,2) not null default 300,
  product_image_url text,
  status text not null check (status in (
    'created',
    'waiting_payment',
    'waiting_admin',
    'payment_confirmed',
    'in_progress',
    'completed',
    'on_hold',
    'refunded',
    'closed'
  )) default 'created',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Optional multiple receipts (keep 1+ proofs)
create table if not exists receipts (
  id uuid primary key default gen_random_uuid(),
  escrow_id uuid not null references escrows(id) on delete cascade,
  uploaded_by uuid not null references profiles(id) on delete cascade,
  file_path text not null, -- storage path in 'receipts' bucket
  created_at timestamp with time zone default now()
);

-- Admin settings (latest row wins)
create table if not exists admin_settings (
  id bigserial primary key,
  bank_name text not null,
  account_number text not null,
  account_holder text not null,
  updated_at timestamp with time zone default now()
);

-- Status audit log
create table if not exists status_logs (
  id uuid primary key default gen_random_uuid(),
  escrow_id uuid not null references escrows(id) on delete cascade,
  status text not null,
  changed_by uuid references profiles(id) on delete set null,
  created_at timestamp with time zone default now()
);

-- Disputes (optional)
create table if not exists disputes (
  id uuid primary key default gen_random_uuid(),
  escrow_id uuid not null references escrows(id) on delete cascade,
  raised_by uuid references profiles(id) on delete set null,
  reason text,
  status text check (status in ('open','resolved','rejected')) default 'open',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Chat messages for escrow transactions
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  escrow_id uuid not null references escrows(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  message text not null,
  message_type text check (message_type in ('text', 'system', 'warning')) default 'text',
  is_read boolean default false,
  created_at timestamp with time zone default now()
);

-- Chat participants (to track who has access to chat)
create table if not exists chat_participants (
  id uuid primary key default gen_random_uuid(),
  escrow_id uuid not null references escrows(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  joined_at timestamp with time zone default now(),
  last_read_at timestamp with time zone default now(),
  unique(escrow_id, user_id)
);

-- Table to store one-time tokens
create table if not exists one_time_tokens (
  id uuid primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone default now()
);

-- Lightweight admin lookup table to avoid RLS recursion when policies need to check admin
create table if not exists admin_users (
  user_id uuid primary key references profiles(id)
);

-- Create a function to automatically create profiles for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (new.id, new.email, COALESCE(new.raw_user_meta_data->>'full_name', ''), 'seller')
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);
  RETURN new;
END;
$$ language plpgsql security definer;

-- Create the trigger for new user signups
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Simple trigger to keep updated_at fresh
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end; $$ language plpgsql;

create or replace trigger escrows_set_updated
before update on escrows
for each row execute function set_updated_at();

-- Create the RPC function to consume one-time tokens
CREATE OR REPLACE FUNCTION public.consume_one_time_token(p_id uuid)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v_user_id text;
BEGIN
  -- Atomically select and delete the token
  DELETE FROM one_time_tokens
  WHERE id = p_id
  AND expires_at > now()
  RETURNING user_id INTO v_user_id;

  -- Return the user_id if found, otherwise null
  RETURN v_user_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.consume_one_time_token(uuid) TO authenticated;
