-- Core multi-site isolation. Additive/backward-compatible with the current TAZA production code.

alter table public.app_sessions
  add column if not exists is_master_admin boolean not null default false;

update public.app_sessions
set admin_site_id=coalesce(admin_site_id,'taza'),
    is_master_admin=true
where is_admin=true;

create table if not exists public.site_user_memberships (
  site_id text not null references public.sites(id) on delete cascade,
  user_id bigint not null references public.users(id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key(site_id,user_id)
);
alter table public.site_user_memberships enable row level security;
revoke all on public.site_user_memberships from public,anon,authenticated;
grant select,insert,update,delete on public.site_user_memberships to service_role;

create or replace function public.kino_touch_site_user(p_site text,p_user bigint)
returns table(ok boolean)
language plpgsql
set search_path=''
as $$
begin
  if p_site not in ('taza','kino-drama','kinochid','fire') or p_user is null then
    raise exception 'Invalid site membership' using errcode='22023';
  end if;
  perform 1 from public.users where id=p_user;
  if not found then raise exception 'Unknown user' using errcode='P0404'; end if;

  insert into public.site_user_memberships(site_id,user_id)
  values(p_site,p_user)
  on conflict(site_id,user_id) do update set last_seen_at=clock_timestamp();

  return query select true;
end $$;

revoke all on function public.kino_touch_site_user(text,bigint) from public,anon,authenticated;
grant execute on function public.kino_touch_site_user(text,bigint) to service_role;

create table if not exists public.site_settings (
  site_id text primary key references public.sites(id) on delete cascade,
  messenger_url text not null default '',
  bank_name text not null default 'Хаан банк',
  bank_account text not null default '5251258979',
  account_name text not null default 'Т.Жаргалбаяр',
  bank_iban text not null default 'MN03000500',
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
revoke all on public.site_settings from public,anon,authenticated;
grant select,insert,update,delete on public.site_settings to service_role;

insert into public.site_settings(site_id)
values ('taza'),('kino-drama'),('kinochid'),('fire')
on conflict(site_id) do nothing;

alter table public.site_appearance drop constraint if exists site_appearance_id_check;
alter table public.site_appearance alter column id drop default;

insert into public.site_appearance(id,layout,tone,revision,site_id)
select x.id,a.layout,a.tone,0,x.site_id
from public.site_appearance a
cross join (values
  (2,'kino-drama'),
  (3,'kinochid'),
  (4,'fire')
) x(id,site_id)
where a.site_id='taza'
on conflict(site_id) do nothing;

create table if not exists public.site_analytics_state (
  site_id text primary key references public.sites(id) on delete cascade,
  reset_at timestamptz not null default '1970-01-01 00:00:00+00',
  updated_at timestamptz not null default now()
);
insert into public.site_analytics_state(site_id)
values('taza'),('kino-drama'),('kinochid'),('fire')
on conflict(site_id) do nothing;
alter table public.site_analytics_state enable row level security;
revoke all on public.site_analytics_state from public,anon,authenticated;
grant select,insert,update,delete on public.site_analytics_state to service_role;

create unique index if not exists site_admins_one_active_site_idx
on public.site_admins(site_id)
where active=true;

-- Existing legacy wallet functions are now explicitly TAZA-only so preview data
-- from other sites can never be spent on the current production site.
create or replace function public.kino_wallet_balance(p_user bigint)
returns table(balance bigint)
language sql
stable
set search_path=''
as $$
  select coalesce(sum(w.delta),0)::bigint
  from public.wallet_ledger w
  where w.user_id=p_user and w.site_id='taza';
$$;

create or replace function public.kino_wallet_balance_site(p_user bigint,p_site text)
returns table(balance bigint)
language sql
stable
set search_path=''
as $$
  select coalesce(sum(w.delta),0)::bigint
  from public.wallet_ledger w
  where w.user_id=p_user and w.site_id=p_site
    and p_site in ('taza','kino-drama','kinochid','fire');
$$;

create or replace function public.kino_wallet_purchase_site(
  p_user bigint,p_site text,p_film bigint,p_request uuid
)
returns table(result text,balance bigint,price integer,payment_id bigint)
language plpgsql
set search_path=''
as $$
declare
  owner public.users;
  f public.films;
  category text;
  cat_plan text;
  bal bigint;
  entitlement_id bigint;
begin
  if p_user is null or p_film is null or p_request is null
     or p_site not in ('taza','kino-drama','kinochid','fire') then
    raise exception 'Invalid wallet purchase' using errcode='22023';
  end if;

  select * into owner from public.users where id=p_user for update;
  if not found then raise exception 'Unknown user' using errcode='P0404'; end if;

  select * into f from public.films where id=p_film and site_id=p_site;
  if not found then raise exception 'Unknown film' using errcode='P0404'; end if;

  select coalesce(sum(w.delta),0)::bigint into bal
  from public.wallet_ledger w where w.user_id=p_user and w.site_id=p_site;

  if f.free is true or f.locked is false then
    return query select 'free'::text,bal,0::integer,null::bigint; return;
  end if;

  category:=coalesce(nullif(split_part(coalesce(f.badge,''),'|',2),''),'Эротик');
  cat_plan:=case category when 'Гадаад' then 'gadaad' when 'Хятад' then 'hyatad'
    when 'Орос' then 'oros' else 'erotic' end;

  if exists(
    select 1 from public.pending_payments p
    where p.user_id=p_user and p.site_id=p_site and p.status='confirmed'
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
    return query select 'owned'::text,bal,coalesce(f.price,0)::integer,null::bigint; return;
  end if;

  if f.price is null or f.price<=0 then raise exception 'Invalid film price' using errcode='22023'; end if;
  if bal<f.price then return query select 'insufficient'::text,bal,f.price::integer,null::bigint; return; end if;

  insert into public.pending_payments(ref_code,user_id,phone,film_id,plan,amount,status,confirmed_at,site_id)
  values('wallet-'||p_request::text,p_user,owner.phone,p_film,'single',0,'confirmed',clock_timestamp(),p_site)
  returning id into entitlement_id;

  insert into public.wallet_ledger(user_id,delta,kind,payment_id,film_id,site_id)
  values(p_user,-f.price,'purchase',entitlement_id,p_film,p_site);

  bal:=bal-f.price;
  return query select 'purchased'::text,bal,f.price::integer,entitlement_id;
end $$;

create or replace function public.kino_wallet_purchase_plan_site(
  p_user bigint,p_site text,p_plan text,p_request uuid
)
returns table(result text,balance bigint,price integer,payment_id bigint)
language plpgsql
set search_path=''
as $$
declare
  owner public.users;
  bal bigint;
  plan_price integer;
  duration_days integer;
  entitlement_id bigint;
  category_key text;
begin
  if p_user is null or p_request is null or
     p_site not in ('taza','kino-drama','kinochid','fire') then
    raise exception 'Invalid wallet package purchase' using errcode='22023';
  end if;

  plan_price:=case p_plan
    when 'erotic_3day' then 8000 when 'gadaad_3day' then 8000 when 'hyatad_3day' then 8000 when 'oros_3day' then 8000
    when 'erotic_1month' then 12500 when 'gadaad_1month' then 12500 when 'hyatad_1month' then 12500 when 'oros_1month' then 12500
    when 'all_1month' then 20000 else null end;
  if plan_price is null then raise exception 'Unknown wallet package plan' using errcode='22023'; end if;

  duration_days:=case when p_plan like '%_3day' then 3 else 30 end;
  category_key:=case when p_plan='all_1month' then null else split_part(p_plan,'_',1) end;

  select * into owner from public.users where id=p_user for update;
  if not found then raise exception 'Unknown user' using errcode='P0404'; end if;

  select coalesce(sum(w.delta),0)::bigint into bal
  from public.wallet_ledger w where w.user_id=p_user and w.site_id=p_site;

  if exists(
    select 1 from public.pending_payments p
    where p.user_id=p_user and p.site_id=p_site and p.status='confirmed'
      and (
        (p.plan=p_plan and coalesce(p.confirmed_at,p.created_at)>now()-(duration_days||' days')::interval)
        or (category_key is not null and p.plan='all_1month' and coalesce(p.confirmed_at,p.created_at)>now()-interval '30 days')
        or (category_key is not null and p_plan like '%_3day' and p.plan=category_key||'_1month' and coalesce(p.confirmed_at,p.created_at)>now()-interval '30 days')
        or (p.plan in ('monthly','1month') and coalesce(p.confirmed_at,p.created_at)>now()-interval '30 days')
        or (p.plan='1year' and coalesce(p.confirmed_at,p.created_at)>now()-interval '365 days')
      )
  ) then return query select 'owned'::text,bal,plan_price,null::bigint; return; end if;

  if bal<plan_price then return query select 'insufficient'::text,bal,plan_price,null::bigint; return; end if;

  insert into public.pending_payments(ref_code,user_id,phone,film_id,plan,amount,status,confirmed_at,site_id)
  values('wallet-plan-'||p_request::text,p_user,owner.phone,null,p_plan,0,'confirmed',clock_timestamp(),p_site)
  returning id into entitlement_id;

  insert into public.wallet_ledger(user_id,delta,kind,payment_id,film_id,site_id)
  values(p_user,-plan_price,'purchase',entitlement_id,null,p_site);

  bal:=bal-plan_price;
  return query select 'purchased'::text,bal,plan_price,entitlement_id;
end $$;

create or replace function public.kino_wallet_prepare_topup_site(
  p_user bigint,p_site text,p_amount integer,p_ref text
)
returns table(id bigint,ref_code text,user_id bigint,film_id bigint,plan text,amount integer,status text,created_at timestamptz,confirmed_at timestamptz,site_id text)
language plpgsql
set search_path=''
as $$
declare saved public.pending_payments; owner public.users;
begin
  if p_user is null or p_site not in ('taza','kino-drama','kinochid','fire')
     or p_amount is null or p_amount<5000 or p_amount>200000 or p_amount%1000<>0
     or p_ref !~ '^\\d{6}$' then
    raise exception 'Invalid wallet topup request' using errcode='22023';
  end if;
  select * into owner from public.users where id=p_user for update;
  if not found then raise exception 'Unknown user' using errcode='P0404'; end if;

  select * into saved from public.pending_payments p
  where p.user_id=p_user and p.site_id=p_site and p.plan='wallet_topup'
    and p.amount=p_amount and p.status='pending' and p.created_at>=now()-interval '24 hours'
  order by p.created_at desc limit 1 for update;

  if not found then
    if exists(select 1 from public.pending_payments p where p.ref_code=p_ref) then
      raise exception 'Reference conflict' using errcode='P0409';
    end if;
    insert into public.pending_payments(ref_code,user_id,phone,film_id,plan,amount,status,site_id)
    values(p_ref,p_user,owner.phone,null,'wallet_topup',p_amount,'pending',p_site)
    returning * into saved;
  end if;

  return query select saved.id,saved.ref_code,saved.user_id,saved.film_id,saved.plan,
    saved.amount,saved.status,saved.created_at,saved.confirmed_at,saved.site_id;
end $$;

-- SMS confirmation keeps using the globally unique ref code, but credits the
-- wallet belonging to the payment's own site.
create or replace function public.kino_wallet_confirm_sms_topup(
  p_payment bigint,p_ref text,p_amount integer,p_message_hash text,p_allow_expired boolean default false
)
returns table(result text,balance bigint,credited_payment_id bigint)
language plpgsql
set search_path=''
as $$
declare
  source public.pending_payments;
  receipt_id bigint; credited_id bigint; existing_credit bigint; source_credit_tracked boolean;
begin
  if p_payment is null or p_ref is null or p_amount is null or p_amount<5000 or p_amount>200000
     or p_message_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid SMS wallet topup' using errcode='22023';
  end if;

  select * into source from public.pending_payments where id=p_payment for update;
  if not found then raise exception 'Unknown payment' using errcode='P0404'; end if;
  if source.user_id is null or source.plan<>'wallet_topup' or source.ref_code<>p_ref then raise exception 'Topup mismatch' using errcode='P0409'; end if;
  if source.status='revoked' then raise exception 'Topup revoked' using errcode='P0409'; end if;
  if source.status not in ('pending','confirmed','expired') then raise exception 'Invalid topup status' using errcode='P0409'; end if;
  if source.status='expired' and not p_allow_expired then raise exception 'Topup expired' using errcode='P0409'; end if;
  if source.status='pending' and not p_allow_expired and
     (source.created_at is null or source.created_at<now()-interval '24 hours' or source.created_at>now()+interval '2 minutes')
  then raise exception 'Topup expired' using errcode='P0409'; end if;

  perform 1 from public.users where id=source.user_id for update;
  if not found then raise exception 'Unknown user' using errcode='P0404'; end if;

  select r.credited_payment_id into existing_credit from public.bank_sms_receipts r where r.message_hash=p_message_hash;
  if found then
    return query select 'already_confirmed'::text,coalesce(sum(w.delta),0)::bigint,existing_credit
    from public.wallet_ledger w where w.user_id=source.user_id and w.site_id=source.site_id;
    return;
  end if;

  insert into public.bank_sms_receipts(message_hash,source_payment_id,user_id,ref_code,amount)
  values(p_message_hash,source.id,source.user_id,p_ref,p_amount)
  on conflict(message_hash) do nothing returning id into receipt_id;

  if receipt_id is null then
    select r.credited_payment_id into existing_credit from public.bank_sms_receipts r where r.message_hash=p_message_hash;
    return query select 'already_confirmed'::text,coalesce(sum(w.delta),0)::bigint,existing_credit
    from public.wallet_ledger w where w.user_id=source.user_id and w.site_id=source.site_id;
    return;
  end if;

  if source.status='pending' or (source.status='expired' and p_allow_expired) then
    update public.pending_payments set amount=p_amount,status='confirmed',confirmed_at=clock_timestamp()
    where id=source.id and status in ('pending','expired') returning id into credited_id;
    if credited_id is null then raise exception 'Topup state changed' using errcode='P0409'; end if;
  else
    select exists(
      select 1 from public.bank_sms_receipts r
      where r.source_payment_id=source.id and r.credited_payment_id=source.id and r.id<>receipt_id
    ) into source_credit_tracked;

    if not source_credit_tracked and exists(
      select 1 from public.wallet_ledger w where w.payment_id=source.id and w.kind='topup'
    ) then
      credited_id:=source.id;
      update public.bank_sms_receipts set credited_payment_id=credited_id where id=receipt_id;
      return query select 'already_confirmed'::text,coalesce(sum(w.delta),0)::bigint,credited_id
      from public.wallet_ledger w where w.user_id=source.user_id and w.site_id=source.site_id;
      return;
    end if;

    insert into public.pending_payments(ref_code,user_id,phone,film_id,plan,amount,status,confirmed_at,site_id)
    values('sms-'||p_message_hash,source.user_id,source.phone,null,'wallet_topup',p_amount,'confirmed',clock_timestamp(),source.site_id)
    returning id into credited_id;
  end if;

  insert into public.wallet_ledger(user_id,delta,kind,payment_id,film_id,site_id)
  values(source.user_id,p_amount,'topup',credited_id,null,source.site_id)
  on conflict(payment_id) do nothing;

  update public.bank_sms_receipts set credited_payment_id=credited_id where id=receipt_id;

  return query select 'confirmed'::text,coalesce(sum(w.delta),0)::bigint,credited_id
  from public.wallet_ledger w where w.user_id=source.user_id and w.site_id=source.site_id;
end $$;

revoke all on function public.kino_wallet_balance_site(bigint,text) from public,anon,authenticated;
revoke all on function public.kino_wallet_purchase_site(bigint,text,bigint,uuid) from public,anon,authenticated;
revoke all on function public.kino_wallet_purchase_plan_site(bigint,text,text,uuid) from public,anon,authenticated;
revoke all on function public.kino_wallet_prepare_topup_site(bigint,text,integer,text) from public,anon,authenticated;
grant execute on function public.kino_wallet_balance_site(bigint,text) to service_role;
grant execute on function public.kino_wallet_purchase_site(bigint,text,bigint,uuid) to service_role;
grant execute on function public.kino_wallet_purchase_plan_site(bigint,text,text,uuid) to service_role;
grant execute on function public.kino_wallet_prepare_topup_site(bigint,text,integer,text) to service_role;

notify pgrst,'reload schema';
