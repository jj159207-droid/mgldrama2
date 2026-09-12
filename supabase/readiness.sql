begin;
create or replace function public.kino_readiness()
returns table(check_name text,ok boolean)
language sql security definer set search_path=public as $$
 select 'tables_private',count(*)=7 and bool_and(c.relrowsecurity
  and not has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE'))
 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
 and c.relname in ('users','films','pending_payments','contact_messages','sms_logs','app_sessions','app_auth_attempts')
 union all
 select 'poster_bucket',exists(select 1 from storage.buckets where id='kino-posters' and public=true and file_size_limit<=200000 and allowed_mime_types=array['image/webp'])
 union all
 select 'poster_policies',count(*)=3 and bool_and(not polpermissive) from pg_policy where polrelid='storage.objects'::regclass
 and polname in ('kino_posters_no_client_insert','kino_posters_no_client_update','kino_posters_no_client_delete')
 union all
 select 'payment_refs_unique',exists(select 1 from pg_index where indrelid='public.pending_payments'::regclass and indisunique and indisvalid and indexrelid=to_regclass('public.kino_payment_ref_unique'))
 union all
 select 'inline_posters',not exists(select 1 from public.films where img like 'data:image/%')
 union all
 select 'private_functions',not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.prosecdef and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE')));
$$;
revoke all on function public.kino_readiness() from public,anon,authenticated;
grant execute on function public.kino_readiness() to service_role;
create index if not exists kino_films_cursor on public.films(id);
notify pgrst,'reload schema';
commit;
