-- Enable required extensions
create extension if not exists pgcrypto;

-- Profiles mirror auth.users, hold telegram mapping + role + banking info
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

-- Enable RLS
alter table profiles enable row level security;
alter table escrows enable row level security;
alter table receipts enable row level security;
alter table admin_settings enable row level security;
alter table status_logs enable row level security;
alter table disputes enable row level security;

-- PROFILES POLICIES
create policy "own profile read" on profiles for select using (auth.uid() = id);
create policy "own profile update" on profiles for update using (auth.uid() = id);
create policy "admin read profiles" on profiles for select using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- ESCROWS POLICIES
create policy "seller insert escrow" on escrows for insert with check (seller_id = auth.uid());
create policy "member read escrows" on escrows for select using (
  seller_id = auth.uid() or buyer_id = auth.uid() or exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);
create policy "seller update own" on escrows for update using (seller_id = auth.uid());
create policy "buyer update own" on escrows for update using (buyer_id = auth.uid());
create policy "admin all escrows" on escrows for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- RECEIPTS POLICIES
create policy "insert own receipt" on receipts for insert with check (uploaded_by = auth.uid());
create policy "member read receipts" on receipts for select using (
  uploaded_by = auth.uid() or exists (
    select 1 from escrows e where e.id = escrow_id and (e.seller_id = auth.uid() or e.buyer_id = auth.uid())
  ) or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- ADMIN SETTINGS POLICIES
create policy "read settings (auth users)" on admin_settings for select using (auth.uid() is not null);
create policy "admin write settings" on admin_settings for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- STATUS LOGS POLICIES
create policy "member read logs" on status_logs for select using (
  exists (select 1 from escrows e where e.id = escrow_id and (e.seller_id = auth.uid() or e.buyer_id = auth.uid()))
  or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "member write logs" on status_logs for insert with check (
  exists (select 1 from escrows e where e.id = escrow_id and (e.seller_id = auth.uid() or e.buyer_id = auth.uid()))
  or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- DISPUTES POLICIES
create policy "member read disputes" on disputes for select using (
  exists (select 1 from escrows e where e.id = escrow_id and (e.seller_id = auth.uid() or e.buyer_id = auth.uid()))
  or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "member write disputes" on disputes for all using (
  exists (select 1 from escrows e where e.id = escrow_id and (e.seller_id = auth.uid() or e.buyer_id = auth.uid()))
  or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
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
