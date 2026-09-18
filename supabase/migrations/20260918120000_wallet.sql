-- Wallet / prepaid balance for low-price movies.
-- Additive migration: does not modify existing balances, films, users or entitlements.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table if not exists public.wallet_ledger (
  id bigint generated always as identity primary key,
  user_id bigint not null references public.users(id) on delete restrict,
  delta integer not null check (delta <> 0),
  kind text not null check (kind in ('topup','purchase')),
  payment_id bigint not null references public.pending_payments(id) on delete restrict,
  film_id bigint references public.films(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(payment_id)
);

create index if not exists kino_wallet_owner_cursor
  on public.wallet_ledger(user_id,id);

alter table public.wallet_ledger enable row level security;
revoke all on public.wallet_ledger from public,anon,authenticated;
grant select,insert on public.wallet_ledger to service_role;
revoke all on sequence public.wallet_ledger_id_seq from public,anon,authenticated;
grant usage,select on sequence public.wallet_ledger_id_seq to service_role;

create or replace function public.kino_wallet_balance(p_user bigint)
returns table(balance bigint)
language sql stable security invoker set search_path = '' as $$
  select coalesce(sum(w.delta),0)::bigint
  from public.wallet_ledger w
  where w.user_id=p_user;
$$;
revoke all on function public.kino_wallet_balance(bigint) from public,anon,authenticated;
grant execute on function public.kino_wallet_balance(bigint) to service_role;

create or replace function public.kino_wallet_confirm_topup(
  p_payment bigint,
  p_ref text,
  p_amount integer,
  p_allow_expired boolean default false
)
returns table(result text,balance bigint)
language plpgsql security invoker set search_path = '' as $$
declare
  saved public.pending_payments;
  was_confirmed boolean;
begin
  if p_payment is null or p_ref is null or p_amount is null or p_amount < 5000 then
    raise exception 'Invalid wallet topup' using errcode='22023';
  end if;

  select * into saved
  from public.pending_payments
  where id=p_payment
  for update;

  if not found then raise exception 'Unknown payment' using errcode='P0404'; end if;
  if saved.user_id is null or saved.plan <> 'wallet_topup'
     or saved.ref_code <> p_ref or saved.amount <> p_amount then
    raise exception 'Topup mismatch' using errcode='P0409';
  end if;
  if saved.status='revoked' then raise exception 'Topup revoked' using errcode='P0409'; end if;
  if saved.status not in ('pending','confirmed') then raise exception 'Invalid topup status' using errcode='P0409'; end if;
  if not p_allow_expired and saved.status='pending'
     and (saved.created_at is null or saved.created_at < now()-interval '24 hours' or saved.created_at > now()+interval '2 minutes') then
    raise exception 'Topup expired' using errcode='P0409';
  end if;

  perform 1 from public.users where id=saved.user_id for update;
  if not found then raise exception 'Unknown user' using errcode='P0404'; end if;

  was_confirmed := saved.status='confirmed';
  if not was_confirmed then
    update public.pending_payments
       set status='confirmed', confirmed_at=clock_timestamp()
     where id=saved.id and status='pending'
     returning * into saved;
    if not found then raise exception 'Topup state changed' using errcode='P0409'; end if;
  end if;

  insert into public.wallet_ledger(user_id,delta,kind,payment_id,film_id)
  values(saved.user_id,p_amount,'topup',saved.id,null)
  on conflict(payment_id) do nothing;

  return query
  select case when was_confirmed then 'already_confirmed' else 'confirmed' end,
         coalesce(sum(w.delta),0)::bigint
  from public.wallet_ledger w
  where w.user_id=saved.user_id;
end $$;
revoke all on function public.kino_wallet_confirm_topup(bigint,text,integer,boolean) from public,anon,authenticated;
grant execute on function public.kino_wallet_confirm_topup(bigint,text,integer,boolean) to service_role;

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
  cat_plan := case category when 'Гадаад' then 'gadaad' when 'Хятад' then 'hyatad' else 'erotic' end;

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
