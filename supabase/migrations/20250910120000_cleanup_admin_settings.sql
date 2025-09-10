-- Cleanup migration: keep a single canonical admin_settings row (id = 1)
-- Safe approach: copy latest row into id=1, delete others, and reset sequence.
-- Run this in your Supabase SQL editor. This is destructive for duplicate rows; backup first if needed.

begin;

-- pick the latest row by updated_at
with latest as (
  select bank_name, account_number, account_holder, updated_at
  from admin_settings
  order by updated_at desc
  limit 1
)

-- upsert into id = 1
insert into admin_settings (id, bank_name, account_number, account_holder, updated_at)
select 1, bank_name, account_number, account_holder, updated_at from latest
on conflict (id) do update set
  bank_name = excluded.bank_name,
  account_number = excluded.account_number,
  account_holder = excluded.account_holder,
  updated_at = excluded.updated_at;

-- delete any other rows
delete from admin_settings where id <> 1;

-- ensure sequence is at least 1
select setval(pg_get_serial_sequence('admin_settings','id'), (select greatest(max(id),1) from admin_settings));

commit;
