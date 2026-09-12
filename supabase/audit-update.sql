-- Requires setup.sql. Serializes settings writes without deleting old rows.
begin;
create or replace function public.kino_save_settings(settings_value text)
returns setof public.sms_logs
language plpgsql security definer set search_path = public as $$
begin
 perform pg_advisory_xact_lock(48129317);
 update public.sms_logs set value=settings_value where key='site_settings';
 if not found then
   insert into public.sms_logs(key,value,text) values('site_settings',settings_value,'settings');
 end if;
 return query select * from public.sms_logs where key='site_settings' order by id desc limit 1;
end; $$;
revoke all on function public.kino_save_settings(text) from public, anon, authenticated;
grant execute on function public.kino_save_settings(text) to service_role;
create index if not exists kino_payments_owner_status_cursor on public.pending_payments(user_id,status,id);
-- A legacy PUBLIC grant must not bypass the role-specific privilege revokes.
do $$ declare t text; begin
 foreach t in array array['users','films','pending_payments','contact_messages','sms_logs','app_sessions','app_auth_attempts'] loop
   execute format('revoke all on table public.%I from public',t);
 end loop;
end $$;
notify pgrst, 'reload schema';
commit;
