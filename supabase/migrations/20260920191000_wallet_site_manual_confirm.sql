create or replace function public.kino_wallet_confirm_topup_site(
  p_payment bigint,p_site text,p_ref text,p_amount integer,p_allow_expired boolean default false
)
returns table(result text,balance bigint)
language plpgsql
set search_path=''
as $$
declare saved public.pending_payments; was_confirmed boolean;
begin
  if p_site not in ('taza','kino-drama','kinochid','fire') or p_payment is null or p_ref is null
     or p_amount is null or p_amount<5000 or p_amount>200000
  then raise exception 'Invalid wallet topup' using errcode='22023'; end if;

  select * into saved from public.pending_payments where id=p_payment and site_id=p_site for update;
  if not found then raise exception 'Unknown payment' using errcode='P0404'; end if;
  if saved.user_id is null or saved.plan<>'wallet_topup' or saved.ref_code<>p_ref
  then raise exception 'Topup mismatch' using errcode='P0409'; end if;
  if saved.status='revoked' then raise exception 'Topup revoked' using errcode='P0409'; end if;
  if saved.status not in ('pending','confirmed','expired') then raise exception 'Invalid topup status' using errcode='P0409'; end if;
  if saved.status='expired' and not p_allow_expired then raise exception 'Topup expired' using errcode='P0409'; end if;
  if not p_allow_expired and saved.status='pending'
     and (saved.created_at is null or saved.created_at<now()-interval '24 hours' or saved.created_at>now()+interval '2 minutes')
  then raise exception 'Topup expired' using errcode='P0409'; end if;

  perform 1 from public.users where id=saved.user_id for update;
  if not found then raise exception 'Unknown user' using errcode='P0404'; end if;

  was_confirmed:=saved.status='confirmed';
  if was_confirmed and saved.amount<>p_amount then raise exception 'Confirmed topup amount mismatch' using errcode='P0409'; end if;

  if not was_confirmed then
    update public.pending_payments set amount=p_amount,status='confirmed',confirmed_at=clock_timestamp()
    where id=saved.id and site_id=p_site and status in ('pending','expired')
    returning * into saved;
    if not found then raise exception 'Topup state changed' using errcode='P0409'; end if;
  end if;

  insert into public.wallet_ledger(user_id,delta,kind,payment_id,film_id,site_id)
  values(saved.user_id,p_amount,'topup',saved.id,null,p_site)
  on conflict(payment_id) do nothing;

  return query
  select case when was_confirmed then 'already_confirmed' else 'confirmed' end,
         coalesce(sum(w.delta),0)::bigint
  from public.wallet_ledger w
  where w.user_id=saved.user_id and w.site_id=p_site;
end $$;

create or replace function public.kino_wallet_confirm_topup(
  p_payment bigint,p_ref text,p_amount integer,p_allow_expired boolean default false
)
returns table(result text,balance bigint)
language sql
set search_path=''
as $$
  select * from public.kino_wallet_confirm_topup_site(p_payment,'taza',p_ref,p_amount,p_allow_expired);
$$;

create or replace function public.kino_wallet_prepare_topup(p_user bigint,p_amount integer,p_ref text)
returns table(id bigint,ref_code text,user_id bigint,film_id bigint,plan text,amount integer,status text,created_at timestamptz,confirmed_at timestamptz)
language sql
set search_path=''
as $$
  select id,ref_code,user_id,film_id,plan,amount,status,created_at,confirmed_at
  from public.kino_wallet_prepare_topup_site(p_user,'taza',p_amount,p_ref);
$$;

create or replace function public.kino_wallet_purchase(p_user bigint,p_film bigint,p_request uuid)
returns table(result text,balance bigint,price integer,payment_id bigint)
language sql
set search_path=''
as $$
  select * from public.kino_wallet_purchase_site(p_user,'taza',p_film,p_request);
$$;

create or replace function public.kino_wallet_purchase_plan(p_user bigint,p_plan text,p_request uuid)
returns table(result text,balance bigint,price integer,payment_id bigint)
language sql
set search_path=''
as $$
  select * from public.kino_wallet_purchase_plan_site(p_user,'taza',p_plan,p_request);
$$;

revoke all on function public.kino_wallet_confirm_topup_site(bigint,text,text,integer,boolean) from public,anon,authenticated;
grant execute on function public.kino_wallet_confirm_topup_site(bigint,text,text,integer,boolean) to service_role;

notify pgrst,'reload schema';
