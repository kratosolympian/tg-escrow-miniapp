-- Migration: create RPC to atomically consume a one_time_tokens row
-- This function deletes the row with the given id and returns the user_id.
create or replace function consume_one_time_token(p_id uuid) returns text as $$
declare
  v_user_id text;
begin
  delete from one_time_tokens where id = p_id returning user_id into v_user_id;
  return v_user_id;
end;
$$ language plpgsql security definer;
