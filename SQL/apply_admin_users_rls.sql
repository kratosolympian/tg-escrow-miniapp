-- Lightweight admin lookup + safe RLS policy replacements
-- Run this in your Supabase project's SQL editor (or via psql with a privileged connection).

-- 1) Admin lookup table (idempotent)
create table if not exists admin_users (
  user_id uuid primary key references profiles(id)
);

alter table admin_users enable row level security;
drop policy if exists "public read admin_users" on admin_users;
create policy "public read admin_users" on admin_users for select using (true);

-- 2) Replace policies that previously checked profiles.role = 'admin'
-- ESCROWS
drop policy if exists "member read escrows" on escrows;
create policy "member read escrows" on escrows for select using (
  seller_id = auth.uid() or buyer_id = auth.uid() or exists (
    select 1 from admin_users a where a.user_id = auth.uid()
  )
);

drop policy if exists "admin all escrows" on escrows;
create policy "admin all escrows" on escrows for all using (
  exists (select 1 from admin_users a where a.user_id = auth.uid())
);

-- RECEIPTS
drop policy if exists "member read receipts" on receipts;
create policy "member read receipts" on receipts for select using (
  uploaded_by = auth.uid() or exists (
    select 1 from escrows e where e.id = escrow_id and (e.seller_id = auth.uid() or e.buyer_id = auth.uid())
  ) or exists (select 1 from admin_users a where a.user_id = auth.uid())
);

-- ADMIN SETTINGS
drop policy if exists "admin write settings" on admin_settings;
create policy "admin write settings" on admin_settings for all using (
  exists (select 1 from admin_users a where a.user_id = auth.uid())
);

-- STATUS LOGS
drop policy if exists "member read logs" on status_logs;
create policy "member read logs" on status_logs for select using (
  exists (select 1 from escrows e where e.id = escrow_id and (e.seller_id = auth.uid() or e.buyer_id = auth.uid()))
  or exists (select 1 from admin_users a where a.user_id = auth.uid())
);

drop policy if exists "member write logs" on status_logs;
create policy "member write logs" on status_logs for insert with check (
  exists (select 1 from escrows e where e.id = escrow_id and (e.seller_id = auth.uid() or e.buyer_id = auth.uid()))
  or exists (select 1 from admin_users a where a.user_id = auth.uid())
);

-- DISPUTES
drop policy if exists "member read disputes" on disputes;
create policy "member read disputes" on disputes for select using (
  exists (select 1 from escrows e where e.id = escrow_id and (e.seller_id = auth.uid() or e.buyer_id = auth.uid()))
  or exists (select 1 from admin_users a where a.user_id = auth.uid())
);

drop policy if exists "member write disputes" on disputes;
create policy "member write disputes" on disputes for all using (
  exists (select 1 from escrows e where e.id = escrow_id and (e.seller_id = auth.uid() or e.buyer_id = auth.uid()))
  or exists (select 1 from admin_users a where a.user_id = auth.uid())
);

-- CHAT MESSAGES
drop policy if exists "member read chat" on chat_messages;
create policy "member read chat" on chat_messages for select using (
  exists (select 1 from escrows e where e.id = escrow_id and (e.seller_id = auth.uid() or e.buyer_id = auth.uid()))
  or exists (select 1 from admin_users a where a.user_id = auth.uid())
);

drop policy if exists "member write chat" on chat_messages;
create policy "member write chat" on chat_messages for insert with check (
  sender_id = auth.uid() and (
    exists (select 1 from escrows e where e.id = escrow_id and (e.seller_id = auth.uid() or e.buyer_id = auth.uid()))
    or exists (select 1 from admin_users a where a.user_id = auth.uid())
  )
);

drop policy if exists "member update chat" on chat_messages;
create policy "member update chat" on chat_messages for update using (
  exists (select 1 from escrows e where e.id = escrow_id and (e.seller_id = auth.uid() or e.buyer_id = auth.uid()))
  or exists (select 1 from admin_users a where a.user_id = auth.uid())
);

-- CHAT PARTICIPANTS
drop policy if exists "member read participants" on chat_participants;
create policy "member read participants" on chat_participants for select using (
  exists (select 1 from escrows e where e.id = escrow_id and (e.seller_id = auth.uid() or e.buyer_id = auth.uid()))
  or exists (select 1 from admin_users a where a.user_id = auth.uid())
);

drop policy if exists "member write participants" on chat_participants;
create policy "member write participants" on chat_participants for all using (
  user_id = auth.uid() and (
    exists (select 1 from escrows e where e.id = escrow_id and (e.seller_id = auth.uid() or e.buyer_id = auth.uid()))
    or exists (select 1 from admin_users a where a.user_id = auth.uid())
  )
);

-- one_time_tokens left unchanged

-- End of changes
