alter table profiles enable row level security;
alter table escrows enable row level security;
alter table receipts enable row level security;
alter table admin_settings enable row level security;
alter table status_logs enable row level security;
alter table disputes enable row level security;
alter table one_time_tokens enable row level security;

-- PROFILES
create policy "own profile read" on profiles for select using (auth.uid() = id);
create policy "own profile update" on profiles for update using (auth.uid() = id);
create policy "admin read profiles" on profiles for select using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- ESCROWS
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

-- RECEIPTS
create policy "insert own receipt" on receipts for insert with check (uploaded_by = auth.uid());
create policy "member read receipts" on receipts for select using (
  uploaded_by = auth.uid() or exists (
    select 1 from escrows e where e.id = escrow_id and (e.seller_id = auth.uid() or e.buyer_id = auth.uid())
  ) or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- ADMIN SETTINGS
create policy "read settings (public)" on admin_settings for select using (true);
create policy "admin write settings" on admin_settings for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- STATUS LOGS
create policy "member read logs" on status_logs for select using (
  exists (select 1 from escrows e where e.id = escrow_id and (e.seller_id = auth.uid() or e.buyer_id = auth.uid()))
  or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "member write logs" on status_logs for insert with check (
  exists (select 1 from escrows e where e.id = escrow_id and (e.seller_id = auth.uid() or e.buyer_id = auth.uid()))
  or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- DISPUTES
create policy "member read disputes" on disputes for select using (
  exists (select 1 from escrows e where e.id = escrow_id and (e.seller_id = auth.uid() or e.buyer_id = auth.uid()))
  or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "member write disputes" on disputes for all using (
  exists (select 1 from escrows e where e.id = escrow_id and (e.seller_id = auth.uid() or e.buyer_id = auth.uid()))
  or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- CHAT MESSAGES
create policy "member read chat" on chat_messages for select using (
  exists (select 1 from escrows e where e.id = escrow_id and (e.seller_id = auth.uid() or e.buyer_id = auth.uid()))
  or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "member write chat" on chat_messages for insert with check (
  sender_id = auth.uid() and exists (select 1 from escrows e where e.id = escrow_id and (e.seller_id = auth.uid() or e.buyer_id = auth.uid()))
  or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "member update chat" on chat_messages for update using (
  exists (select 1 from escrows e where e.id = escrow_id and (e.seller_id = auth.uid() or e.buyer_id = auth.uid()))
  or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- CHAT PARTICIPANTS
create policy "member read participants" on chat_participants for select using (
  exists (select 1 from escrows e where e.id = escrow_id and (e.seller_id = auth.uid() or e.buyer_id = auth.uid()))
  or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "member write participants" on chat_participants for all using (
  user_id = auth.uid() and exists (select 1 from escrows e where e.id = escrow_id and (e.seller_id = auth.uid() or e.buyer_id = auth.uid()))
  or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- ONE TIME TOKENS
create policy "service role all tokens" on one_time_tokens for all using (
  auth.role() = 'service_role'
);
