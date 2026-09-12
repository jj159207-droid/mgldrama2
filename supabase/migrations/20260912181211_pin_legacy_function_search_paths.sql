-- The inspected legacy bodies use unqualified table names. Public is owned by
-- trusted administrators; anon, authenticated and service_role cannot CREATE
-- there. Put pg_temp last so caller-created tables cannot shadow public tables.
-- Preserve function bodies, owners, ACLs, trigger state and all application data.
set local lock_timeout = '5s';
do $$
declare
  signature text;
  target regprocedure;
begin
  foreach signature in array array[
    'public.auto_confirm_payment()',
    'public.confirm_payment(text)',
    'public.get_film_cats()',
    'public.update_film_cat(bigint,text)'
  ] loop
    target := to_regprocedure(signature);
    if target is not null then
      execute format('alter function %s set search_path = pg_catalog, public, pg_temp', target);
    end if;
  end loop;
end;
$$;
