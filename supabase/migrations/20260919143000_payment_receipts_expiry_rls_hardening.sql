set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Distinguish a real second bank transfer from a retried delivery of the same SMS.
create table if not exists public.bank_sms_receipts (
  id bigint generated always as identity primary key,
  message_hash text not null unique check (message_hash ~ '^[a-f0-9]{64}$'),
  source_payment_id bigint not null references public.pending_payments(id) on delete restrict,
  credited_payment_id bigint references public.pending_payments(id) on delete restrict,
  user_id bigint not null references public.users(id) on delete restrict,
  ref_code text not null,
  amount integer not null check (amount between 5000 and 200000),
  created_at timestamptz not null default now(),
  unique(credited_payment_id)
);

create index if not exists bank_sms_receipts_ref_created_idx
  on public.bank_sms_receipts(ref_code,created_at desc);

alter table public.bank_sms_receipts enable row level security;
revoke all on table public.bank_sms_receipts from public,anon,authenticated;
grant select,insert,update on table public.bank_sms_receipts to service_role;
revoke all on sequence public.bank_sms_receipts_id_seq from public,anon,authenticated;
grant usage,select on sequence public.bank_sms_receipts_id_seq to service_role;

insert into public.bank_sms_receipts(
  message_hash,source_payment_id,credited_payment_id,user_id,ref_code,amount,created_at
)
select distinct on (e.message_hash)
  e.message_hash,p.id,p.id,p.user_id,p.ref_code,e.amount,e.created_at
from public.sms_webhook_events e
join public.pending_payments p on p.ref_code=e.ref_code
join public.wallet_ledger w on w.payment_id=p.id and w.kind='topup'
where e.outcome='wallet_confirmed'
  and e.message_hash ~ '^[a-f0-9]{64}$'
  and p.plan='wallet_topup'
  and p.status='confirmed'
  and e.amount between 5000 and 200000
order by e.message_hash,e.created_at asc
on conflict do nothing;

create or replace function public.kino_wallet_confirm_sms_topup(
  p_payment bigint,
  p_ref text,
  p_amount integer,
  p_message_hash text,
  p_allow_expired boolean default false
)
returns table(result text,balance bigint,credited_payment_id bigint)
language plpgsql security invoker set search_path = '' as $$
declare
  source public.pending_payments;
  receipt_id bigint;
  credited_id bigint;
  existing_credit bigint;
  source_credit_tracked boolean;
begin
  if p_payment is null or p_ref is null or p_amount is null
     or p_amount < 5000 or p_amount > 200000
     or p_message_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid SMS wallet topup' using errcode='22023';
  end if;

  select * into source
  from public.pending_payments
  where id=p_payment
  for update;

  if not found then raise exception 'Unknown payment' using errcode='P0404'; end if;
  if source.user_id is null or source.plan <> 'wallet_topup' or source.ref_code <> p_ref then
    raise exception 'Topup mismatch' using errcode='P0409';
  end if;
  if source.status='revoked' then raise exception 'Topup revoked' using errcode='P0409'; end if;
  if source.status not in ('pending','confirmed','expired') then
    raise exception 'Invalid topup status' using errcode='P0409';
  end if;
  if source.status='expired' and not p_allow_expired then
    raise exception 'Topup expired' using errcode='P0409';
  end if;
  if source.status='pending' and not p_allow_expired
     and (source.created_at is null or source.created_at < now()-interval '24 hours' or source.created_at > now()+interval '2 minutes') then
    raise exception 'Topup expired' using errcode='P0409';
  end if;

  perform 1 from public.users where id=source.user_id for update;
  if not found then raise exception 'Unknown user' using errcode='P0404'; end if;

  select r.credited_payment_id into existing_credit
  from public.bank_sms_receipts r
  where r.message_hash=p_message_hash;

  if found then
    return query
    select 'already_confirmed'::text,
           coalesce(sum(w.delta),0)::bigint,
           existing_credit
    from public.wallet_ledger w
    where w.user_id=source.user_id;
    return;
  end if;

  insert into public.bank_sms_receipts(
    message_hash,source_payment_id,user_id,ref_code,amount
  )
  values(p_message_hash,source.id,source.user_id,p_ref,p_amount)
  on conflict(message_hash) do nothing
  returning id into receipt_id;

  if receipt_id is null then
    select r.credited_payment_id into existing_credit
    from public.bank_sms_receipts r
    where r.message_hash=p_message_hash;
    return query
    select 'already_confirmed'::text,
           coalesce(sum(w.delta),0)::bigint,
           existing_credit
    from public.wallet_ledger w
    where w.user_id=source.user_id;
    return;
  end if;

  if source.status='pending' or (source.status='expired' and p_allow_expired) then
    update public.pending_payments
       set amount=p_amount,status='confirmed',confirmed_at=clock_timestamp()
     where id=source.id and status in ('pending','expired')
     returning id into credited_id;
    if credited_id is null then raise exception 'Topup state changed' using errcode='P0409'; end if;
  else
    select exists(
      select 1
      from public.bank_sms_receipts r
      where r.source_payment_id=source.id
        and r.credited_payment_id=source.id
        and r.id<>receipt_id
    ) into source_credit_tracked;

    if not source_credit_tracked and exists(
      select 1 from public.wallet_ledger w
      where w.payment_id=source.id and w.kind='topup'
    ) then
      credited_id:=source.id;
      update public.bank_sms_receipts
         set credited_payment_id=credited_id
       where id=receipt_id;
      return query
      select 'already_confirmed'::text,
             coalesce(sum(w.delta),0)::bigint,
             credited_id
      from public.wallet_ledger w
      where w.user_id=source.user_id;
      return;
    end if;

    insert into public.pending_payments(
      ref_code,user_id,phone,film_id,plan,amount,status,confirmed_at
    )
    values(
      'sms-'||p_message_hash,
      source.user_id,
      source.phone,
      null,
      'wallet_topup',
      p_amount,
      'confirmed',
      clock_timestamp()
    )
    returning id into credited_id;
  end if;

  insert into public.wallet_ledger(user_id,delta,kind,payment_id,film_id)
  values(source.user_id,p_amount,'topup',credited_id,null)
  on conflict(payment_id) do nothing;

  update public.bank_sms_receipts
     set credited_payment_id=credited_id
   where id=receipt_id;

  return query
  select 'confirmed'::text,
         coalesce(sum(w.delta),0)::bigint,
         credited_id
  from public.wallet_ledger w
  where w.user_id=source.user_id;
end $$;

revoke all on function public.kino_wallet_confirm_sms_topup(bigint,text,integer,text,boolean)
  from public,anon,authenticated;
grant execute on function public.kino_wallet_confirm_sms_topup(bigint,text,integer,text,boolean)
  to service_role;

update public.pending_payments
set status='expired'
where status='pending'
  and created_at < now()-interval '24 hours';

drop index if exists public.pending_payments_cleanup_idx;
create index pending_payments_cleanup_idx
  on public.pending_payments(created_at)
  where status in ('pending','expired','revoked');

select cron.schedule(
  'cleanup-old-payment-records',
  '*/15 * * * *',
  $cron$
    update public.pending_payments
       set status='expired'
     where status='pending'
       and created_at < now() - interval '24 hours';

    delete from public.pending_payments
     where status in ('expired','revoked')
       and created_at < now() - interval '30 days';

    delete from public.sms_logs
     where created_at < now() - interval '30 days'
       and coalesce(key,'') <> 'site_settings';
  $cron$
);

drop policy if exists "Public read" on public.films;
drop policy if exists "Public write" on public.films;
drop policy if exists "allow all" on public.films;
drop policy if exists "allow_all_update" on public.films;
drop policy if exists "films_all" on public.films;
drop policy if exists "public delete" on public.films;
drop policy if exists "public insert" on public.films;
drop policy if exists "public read" on public.films;
drop policy if exists "public update" on public.films;

drop policy if exists "Allow SMS webhook to update payments" on public.pending_payments;
drop policy if exists "Allow anon insert pending payments" on public.pending_payments;
drop policy if exists "Public can read pending_payments" on public.pending_payments;
drop policy if exists "payments_all" on public.pending_payments;
drop policy if exists "public insert" on public.pending_payments;
drop policy if exists "public read" on public.pending_payments;
drop policy if exists "public update" on public.pending_payments;

drop policy if exists "Allow anon to read users by phone" on public.users;
drop policy if exists "Public can read users" on public.users;

revoke all on table public.films,public.pending_payments,public.users
  from public,anon,authenticated;

alter table public.films enable row level security;
alter table public.pending_payments enable row level security;
alter table public.users enable row level security;

notify pgrst,'reload schema';
