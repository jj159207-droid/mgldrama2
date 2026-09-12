-- Existing reviewed app: apply poster storage and HTTPS diagnostics.
-- Run in the Supabase SQL Editor. Re-runnable; does not delete images or films.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('kino-posters','kino-posters',true,200000,array['image/webp'])
on conflict(id) do update set public=true,file_size_limit=200000,allowed_mime_types=array['image/webp'];

-- Restrictive policies also protect this bucket if another application left a
-- permissive "allow all uploads" policy. Other buckets are unaffected.
drop policy if exists kino_posters_no_client_insert on storage.objects;
create policy kino_posters_no_client_insert on storage.objects as restrictive
for insert to anon,authenticated with check(bucket_id <> 'kino-posters');
drop policy if exists kino_posters_no_client_update on storage.objects;
create policy kino_posters_no_client_update on storage.objects as restrictive
for update to anon,authenticated using(bucket_id <> 'kino-posters') with check(bucket_id <> 'kino-posters');
drop policy if exists kino_posters_no_client_delete on storage.objects;
create policy kino_posters_no_client_delete on storage.objects as restrictive
for delete to anon,authenticated using(bucket_id <> 'kino-posters');

-- A migration must not overwrite a poster edited while its upload was running.
create or replace function public.kino_replace_inline_poster(target_id bigint,old_image text,new_image text)
returns table(id bigint) language sql security definer set search_path=public as $$
 update public.films f set img=new_image where f.id=target_id and f.img=old_image
 returning f.id;
$$;
revoke all on function public.kino_replace_inline_poster(bigint,text,text) from public,anon,authenticated;
grant execute on function public.kino_replace_inline_poster(bigint,text,text) to service_role;
notify pgrst,'reload schema';
commit;

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

-- Updated after inspecting the user's actual legacy payment function bodies.
-- Retire the old log trigger and reference-only payment RPC. Current /api/sms
-- confirms pending_payments directly after its sender, secret, amount and age checks.
-- No function bodies, movie rows, payment rows or log rows are changed/deleted.
-- Missing legacy functions are skipped so this also works on a clean database.
begin;
set local lock_timeout = '5s';
do $$
declare
  signature text;
  target regprocedure;
  legacy_trigger record;
begin
  -- Do not disable an unrelated trigger with the same name, or silently modify
  -- another attachment that was not part of the user's inspected definitions.
  if exists (
    select 1 from pg_trigger t
    where t.tgrelid = to_regclass('public.sms_logs')
      and t.tgname = 'trigger_confirm_payment'
      and (t.tgisinternal or t.tgfoid is distinct from to_regprocedure('public.auto_confirm_payment()')::oid)
  ) then
    raise exception 'Unexpected trigger_confirm_payment definition. Inspect before changing it.';
  end if;
  for legacy_trigger in
    select t.tgname, t.tgrelid, t.tgisinternal
    from pg_trigger t
    where t.tgfoid = to_regprocedure('public.auto_confirm_payment()')
  loop
    if legacy_trigger.tgisinternal
      or legacy_trigger.tgrelid is distinct from to_regclass('public.sms_logs')::oid
      or legacy_trigger.tgname <> 'trigger_confirm_payment' then
      raise exception 'Additional legacy payment trigger attachment requires review.';
    end if;
    execute 'alter table public.sms_logs disable trigger trigger_confirm_payment';
  end loop;

  foreach signature in array array[
    'public.auto_confirm_payment()',
    'public.confirm_payment(text)',
    'public.get_film_cats()',
    'public.update_film_cat(bigint,text)'
  ] loop
    target := to_regprocedure(signature);
    if target is not null then
      execute format('revoke execute on function %s from public, anon, authenticated', target);
      if signature in ('public.auto_confirm_payment()', 'public.confirm_payment(text)') then
        execute format('revoke execute on function %s from service_role', target);
        if has_function_privilege('service_role', target, 'EXECUTE') then
          raise exception 'Legacy payment function still callable by service_role: %', signature;
        end if;
      else
        execute format('grant execute on function %s to service_role', target);
      end if;
      if has_function_privilege('anon', target, 'EXECUTE')
        or has_function_privilege('authenticated', target, 'EXECUTE') then
        raise exception 'Legacy function still publicly callable: %', signature;
      end if;
    end if;
  end loop;
end;
$$;
notify pgrst, 'reload schema';
commit;

-- Verification: anon/authenticated should be false for all four functions.
-- server_execute must be false for the two payment functions, true for the
-- two category functions. auto_confirm_payment's trigger_state must be disabled.
select
  p.oid::regprocedure::text as function_name,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as server_execute,
  coalesce((
    select string_agg(t.tgrelid::regclass::text, ', ' order by t.tgrelid::regclass::text)
    from pg_trigger t
    where t.tgfoid = p.oid and not t.tgisinternal
  ), '-') as trigger_tables,
  coalesce((
    select string_agg(case t.tgenabled when 'D' then 'disabled' else 'ENABLED' end, ', ')
    from pg_trigger t where t.tgfoid = p.oid and not t.tgisinternal
  ), '-') as trigger_state
from pg_proc p
where p.oid::regprocedure = any(array[
  to_regprocedure('public.auto_confirm_payment()'),
  to_regprocedure('public.confirm_payment(text)'),
  to_regprocedure('public.get_film_cats()'),
  to_regprocedure('public.update_film_cat(bigint,text)')
])
order by function_name;
