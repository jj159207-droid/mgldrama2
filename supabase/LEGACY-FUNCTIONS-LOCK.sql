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
