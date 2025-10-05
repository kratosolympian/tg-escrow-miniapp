alter table profiles enable row level security;
alter table escrows enable row level security;
alter table receipts enable row level security;
alter table admin_settings enable row level security;
alter table status_logs enable row level security;
alter table disputes enable row level security;
alter table one_time_tokens enable row level security;
alter table user_notifications enable row level security;

create table if not exists admin_users (
  user_id uuid primary key references profiles(id)
);
alter table admin_users enable row level security;
drop policy if exists "public read admin_users" on admin_users;
create policy "public read admin_users" on admin_users for select using (true);

drop policy if exists "own profile read" on profiles;
create policy "own profile read" on profiles for select using (auth.uid() = id);
drop policy if exists "own profile update" on profiles;
create policy "own profile update" on profiles for update using (auth.uid() = id);
drop policy if exists "service role insert profiles" on profiles;
create policy "service role insert profiles" on profiles for insert with check (auth.role() = 'service_role');
drop policy if exists "service role update profiles" on profiles;
create policy "service role update profiles" on profiles for update using (auth.role() = 'service_role');

drop policy if exists "seller insert escrow" on escrows;
create policy "seller insert escrow" on escrows for insert with check (seller_id = auth.uid());
drop policy if exists "member read escrows" on escrows;
create policy "member read escrows" on escrows for select using (
  seller_id = auth.uid() or buyer_id = auth.uid() or exists (
    select 1 from admin_users a where a.user_id = auth.uid()
  )
);
drop policy if exists "seller update own" on escrows;
create policy "seller update own" on escrows for update using (seller_id = auth.uid());
drop policy if exists "buyer update own" on escrows;
create policy "buyer update own" on escrows for update using (buyer_id = auth.uid());
drop policy if exists "admin all escrows" on escrows;
create policy "admin all escrows" on escrows for all using (
  exists (select 1 from admin_users a where a.user_id = auth.uid())
);

drop policy if exists "insert own receipt" on receipts;
create policy "insert own receipt" on receipts for insert with check (uploaded_by = auth.uid());
drop policy if exists "member read receipts" on receipts;
create policy "member read receipts" on receipts for select using (
  uploaded_by = auth.uid() or exists (
    select 1 from escrows e where e.id = escrow_id and (e.seller_id = auth.uid() or e.buyer_id = auth.uid())
  ) or exists (select 1 from admin_users a where a.user_id = auth.uid())
);

drop policy if exists "read settings (public)" on admin_settings;
create policy "read settings (public)" on admin_settings for select using (true);
drop policy if exists "admin write settings" on admin_settings;
create policy "admin write settings" on admin_settings for all using (
  exists (select 1 from admin_users a where a.user_id = auth.uid())
);

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

drop policy if exists "service role all tokens" on one_time_tokens;
create policy "service role all tokens" on one_time_tokens for all using (
  auth.role() = 'service_role'
);

-- User notifications RLS
drop policy if exists "own notifications read" on user_notifications;
create policy "own notifications read" on user_notifications for select using (auth.uid() = user_id);
drop policy if exists "own notifications update" on user_notifications;
create policy "own notifications update" on user_notifications for update using (auth.uid() = user_id);
drop policy if exists "service role insert notifications" on user_notifications;
create policy "service role insert notifications" on user_notifications for insert with check (auth.role() = 'service_role');
