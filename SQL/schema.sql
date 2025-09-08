-- Enable required extensions
create extension if not exists pgcrypto;

-- Profiles mirror auth.users, hold telegram mapping + role
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  telegram_id text unique,
  role text check (role in ('buyer','seller','admin')) default 'buyer',
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

-- Simple trigger to keep updated_at fresh
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end; $$ language plpgsql;

create or replace trigger escrows_set_updated
before update on escrows
for each row execute function set_updated_at();
