-- Wallet topups may be any actual bank-reported amount >= 5,000 MNT.
-- The 6-digit ref identifies the owner; the authenticated bank SMS supplies the final amount.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

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
  if p_payment is null or p_ref is null or p_amount is null
     or p_amount < 5000 or p_amount > 200000 then
    raise exception 'Invalid wallet topup' using errcode='22023';
  end if;

  select * into saved
  from public.pending_payments
  where id=p_payment
  for update;

  if not found then raise exception 'Unknown payment' using errcode='P0404'; end if;
  if saved.user_id is null or saved.plan <> 'wallet_topup' or saved.ref_code <> p_ref then
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
  if was_confirmed and saved.amount <> p_amount then
    raise exception 'Confirmed topup amount mismatch' using errcode='P0409';
  end if;

  if not was_confirmed then
    update public.pending_payments
       set amount=p_amount, status='confirmed', confirmed_at=clock_timestamp()
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
notify pgrst,'reload schema';
