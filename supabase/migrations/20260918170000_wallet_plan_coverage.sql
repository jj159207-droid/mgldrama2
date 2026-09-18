-- Prevent charging for a shorter category plan when a longer active plan already covers it.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function public.kino_wallet_purchase_plan(
  p_user bigint,
  p_plan text,
  p_request uuid
)
returns table(result text,balance bigint,price integer,payment_id bigint)
language plpgsql security invoker set search_path = '' as $$
declare
  owner public.users;
  bal bigint;
  plan_price integer;
  duration_days integer;
  entitlement_id bigint;
  category_key text;
begin
  if p_user is null or p_plan is null or p_request is null then
    raise exception 'Invalid wallet package purchase' using errcode='22023';
  end if;

  plan_price := case p_plan
    when 'erotic_3day' then 8000
    when 'gadaad_3day' then 8000
    when 'hyatad_3day' then 8000
    when 'oros_3day' then 8000
    when 'erotic_1month' then 12500
    when 'gadaad_1month' then 12500
    when 'hyatad_1month' then 12500
    when 'oros_1month' then 12500
    when 'all_1month' then 20000
    else null
  end;
  if plan_price is null then
    raise exception 'Unknown wallet package plan' using errcode='22023';
  end if;

  duration_days := case when p_plan like '%_3day' then 3 else 30 end;
  category_key := case when p_plan='all_1month' then null else split_part(p_plan,'_',1) end;

  select * into owner from public.users where id=p_user for update;
  if not found then raise exception 'Unknown user' using errcode='P0404'; end if;

  select coalesce(sum(w.delta),0)::bigint into bal
  from public.wallet_ledger w where w.user_id=p_user;

  if exists (
    select 1
    from public.pending_payments p
    where p.user_id=p_user
      and p.status='confirmed'
      and (
        (p.plan=p_plan and coalesce(p.confirmed_at,p.created_at)>now()-(duration_days||' days')::interval)
        or (category_key is not null and p.plan='all_1month' and coalesce(p.confirmed_at,p.created_at)>now()-interval '30 days')
        or (category_key is not null and p_plan like '%_3day' and p.plan=category_key||'_1month' and coalesce(p.confirmed_at,p.created_at)>now()-interval '30 days')
        or (p.plan in ('monthly','1month') and coalesce(p.confirmed_at,p.created_at)>now()-interval '30 days')
        or (p.plan='1year' and coalesce(p.confirmed_at,p.created_at)>now()-interval '365 days')
      )
  ) then
    return query select 'owned'::text,bal,plan_price,null::bigint;
    return;
  end if;

  if bal < plan_price then
    return query select 'insufficient'::text,bal,plan_price,null::bigint;
    return;
  end if;

  insert into public.pending_payments(ref_code,user_id,phone,film_id,plan,amount,status,confirmed_at)
  values('wallet-plan-'||p_request::text,p_user,owner.phone,null,p_plan,0,'confirmed',clock_timestamp())
  returning id into entitlement_id;

  insert into public.wallet_ledger(user_id,delta,kind,payment_id,film_id)
  values(p_user,-plan_price,'purchase',entitlement_id,null);

  bal := bal - plan_price;
  return query select 'purchased'::text,bal,plan_price,entitlement_id;
end $$;

revoke all on function public.kino_wallet_purchase_plan(bigint,text,uuid) from public,anon,authenticated;
grant execute on function public.kino_wallet_purchase_plan(bigint,text,uuid) to service_role;

notify pgrst,'reload schema';
