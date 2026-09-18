-- Keep single-film wallet purchases aware of the new Russian category.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function public.kino_wallet_purchase(
  p_user bigint,
  p_film bigint,
  p_request uuid
)
returns table(result text,balance bigint,price integer,payment_id bigint)
language plpgsql security invoker set search_path = '' as $$
declare
  owner public.users;
  f public.films;
  category text;
  cat_plan text;
  bal bigint;
  entitlement_id bigint;
begin
  if p_user is null or p_film is null or p_request is null then
    raise exception 'Invalid wallet purchase' using errcode='22023';
  end if;

  select * into owner from public.users where id=p_user for update;
  if not found then raise exception 'Unknown user' using errcode='P0404'; end if;

  select * into f from public.films where id=p_film;
  if not found then raise exception 'Unknown film' using errcode='P0404'; end if;

  select coalesce(sum(w.delta),0)::bigint into bal
  from public.wallet_ledger w where w.user_id=p_user;

  if f.free is true or f.locked is false then
    return query select 'free'::text,bal,0::integer,null::bigint;
    return;
  end if;

  category := coalesce(nullif(split_part(coalesce(f.badge,''),'|',2),''),'Эротик');
  cat_plan := case category
    when 'Гадаад' then 'gadaad'
    when 'Хятад' then 'hyatad'
    when 'Орос' then 'oros'
    else 'erotic'
  end;

  if exists (
    select 1 from public.pending_payments p
    where p.user_id=p_user and p.status='confirmed'
      and (
        (p.plan='single' and p.film_id=p_film and coalesce(p.confirmed_at,p.created_at)>now()-interval '3 days')
        or (p.plan='3day' and coalesce(p.confirmed_at,p.created_at)>now()-interval '3 days')
        or (p.plan in ('monthly','1month') and coalesce(p.confirmed_at,p.created_at)>now()-interval '30 days')
        or (p.plan='1year' and coalesce(p.confirmed_at,p.created_at)>now()-interval '365 days')
        or (p.plan='all_1month' and coalesce(p.confirmed_at,p.created_at)>now()-interval '30 days')
        or (p.plan=cat_plan||'_3day' and coalesce(p.confirmed_at,p.created_at)>now()-interval '3 days')
        or (p.plan=cat_plan||'_1month' and coalesce(p.confirmed_at,p.created_at)>now()-interval '30 days')
      )
  ) then
    return query select 'owned'::text,bal,coalesce(f.price,0)::integer,null::bigint;
    return;
  end if;

  if f.price is null or f.price <= 0 then
    raise exception 'Invalid film price' using errcode='22023';
  end if;

  if bal < f.price then
    return query select 'insufficient'::text,bal,f.price::integer,null::bigint;
    return;
  end if;

  insert into public.pending_payments(ref_code,user_id,phone,film_id,plan,amount,status,confirmed_at)
  values('wallet-'||p_request::text,p_user,owner.phone,p_film,'single',0,'confirmed',clock_timestamp())
  returning id into entitlement_id;

  insert into public.wallet_ledger(user_id,delta,kind,payment_id,film_id)
  values(p_user,-f.price,'purchase',entitlement_id,p_film);

  bal := bal - f.price;
  return query select 'purchased'::text,bal,f.price::integer,entitlement_id;
end $$;

revoke all on function public.kino_wallet_purchase(bigint,bigint,uuid) from public,anon,authenticated;
grant execute on function public.kino_wallet_purchase(bigint,bigint,uuid) to service_role;

notify pgrst,'reload schema';
