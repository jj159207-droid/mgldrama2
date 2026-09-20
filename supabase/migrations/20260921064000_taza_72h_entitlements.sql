-- Align TAZA entry and package lifetime rules with the 72-hour product.
-- This replaces the earlier "paid once = permanent site entry" behavior.

create or replace function public.kino_site_entry_status(p_user bigint,p_site text)
returns table(allowed boolean, reason text)
language plpgsql
stable
set search_path=''
as $$
begin
  if p_site not in ('taza','kino-drama','kinochid','fire') then
    raise exception 'Invalid site' using errcode='22023';
  end if;

  if p_site <> 'taza' then
    return query select true,'not_gated'::text;
    return;
  end if;

  if p_user is null then
    return query select false,'payment_required'::text;
    return;
  end if;

  if exists(
    select 1
    from public.pending_payments p
    where p.user_id=p_user
      and p.site_id=p_site
      and p.status='confirmed'
      and p.plan not in ('wallet_topup','wallet_admin')
      and coalesce(p.confirmed_at,p.created_at)+
        case
          when p.plan='1year' then interval '365 days'
          else interval '72 hours'
        end > now()
  ) then
    return query select true,'active_entitlement'::text;
    return;
  end if;

  return query select false,'payment_required'::text;
end $$;

revoke all on function public.kino_site_entry_status(bigint,text) from public,anon,authenticated;
grant execute on function public.kino_site_entry_status(bigint,text) to service_role;


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
        (p.plan='single' and p.film_id=p_film and coalesce(p.confirmed_at,p.created_at)>now()-interval '72 hours')
        or (p.plan in ('3day','monthly','1month','all_1month','all_48h','entry_72h') and coalesce(p.confirmed_at,p.created_at)>now()-interval '72 hours')
        or (p.plan=cat_plan||'_3day' and coalesce(p.confirmed_at,p.created_at)>now()-interval '72 hours')
        or (p.plan=cat_plan||'_1month' and coalesce(p.confirmed_at,p.created_at)>now()-interval '72 hours')
        or (p.plan='1year' and coalesce(p.confirmed_at,p.created_at)>now()-interval '365 days')
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

revoke all on function public.kino_wallet_purchase_site(bigint,text,bigint,uuid) from public,anon,authenticated;
grant execute on function public.kino_wallet_purchase_site(bigint,text,bigint,uuid) to service_role;


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
  entitlement_id bigint;
  category_key text;
begin
  if p_user is null or p_request is null or
     p_site not in ('taza','kino-drama','kinochid','fire') then
    raise exception 'Invalid wallet package purchase' using errcode='22023';
  end if;

  plan_price:=case p_plan
    when 'erotic_3day' then 12500 when 'gadaad_3day' then 12500 when 'hyatad_3day' then 12500 when 'oros_3day' then 12500
    when 'erotic_1month' then 12500 when 'gadaad_1month' then 12500 when 'hyatad_1month' then 12500 when 'oros_1month' then 12500
    when 'all_1month' then 12500 else null end;
  if plan_price is null then raise exception 'Unknown wallet package plan' using errcode='22023'; end if;

  category_key:=case when p_plan='all_1month' then null else split_part(p_plan,'_',1) end;

  select * into owner from public.users where id=p_user for update;
  if not found then raise exception 'Unknown user' using errcode='P0404'; end if;

  select coalesce(sum(w.delta),0)::bigint into bal
  from public.wallet_ledger w where w.user_id=p_user and w.site_id=p_site;

  if exists(
    select 1 from public.pending_payments p
    where p.user_id=p_user and p.site_id=p_site and p.status='confirmed'
      and (
        (p.plan=p_plan and coalesce(p.confirmed_at,p.created_at)>now()-interval '72 hours')
        or (p.plan in ('all_1month','all_48h','entry_72h','monthly','1month','3day') and coalesce(p.confirmed_at,p.created_at)>now()-interval '72 hours')
        or (category_key is not null and p.plan in (category_key||'_3day',category_key||'_1month') and coalesce(p.confirmed_at,p.created_at)>now()-interval '72 hours')
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

revoke all on function public.kino_wallet_purchase_plan_site(bigint,text,text,uuid) from public,anon,authenticated;
grant execute on function public.kino_wallet_purchase_plan_site(bigint,text,text,uuid) to service_role;

notify pgrst,'reload schema';
