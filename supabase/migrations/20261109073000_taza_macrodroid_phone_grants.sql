-- Bank SMS with an eight-digit "Utga" reference automatically issues TAZA phone access.
-- The six-digit order system is intentionally left untouched.
-- Do not trust SMS messages without verifying the webhook secret and bank sender.
create table if not exists public.taza_phone_sms_receipts (
  id bigint generated always as identity primary key,
  phone text not null check (phone ~ '^[0-9]{8}$'),
  amount integer not null check (amount in (2000, 12000)),
  message_hash text not null unique check (message_hash ~ '^[0-9a-f]{64}$'),
  sender text not null,
  grant_id bigint references public.taza_phone_grants(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists taza_phone_sms_receipts_phone_date_idx
  on public.taza_phone_sms_receipts (phone, created_at desc);

alter table public.taza_phone_sms_receipts enable row level security;
revoke all on public.taza_phone_sms_receipts from public, anon, authenticated;
revoke all on sequence public.taza_phone_sms_receipts_id_seq from public, anon, authenticated;
grant select, insert, update on public.taza_phone_sms_receipts to service_role;
grant usage, select on sequence public.taza_phone_sms_receipts_id_seq to service_role;

-- SECURITY INVOKER: only the backend service_role can invoke and update the
-- RLS-protected tables. The receipt insertion and grant update are atomic.
create or replace function public.kino_taza_phone_confirm_sms(
  p_phone text, p_amount integer, p_message_hash text, p_sender text
) returns table(result text, grant_id bigint, access_type text)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_receipt_id bigint;
  v_grant_id bigint;
  v_access_type text;
begin
  if p_phone is null or p_phone !~ '^[0-9]{8}$' then
    raise exception 'Invalid eight-digit phone reference' using errcode='22023';
  end if;
  if p_amount is null or p_amount not in (2000,12000) then
    raise exception 'Unsupported TAZA transfer amount' using errcode='22023';
  end if;
  if p_message_hash is null or p_message_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid message fingerprint' using errcode='22023';
  end if;
  if p_sender is null or length(p_sender) < 2 or length(p_sender) > 120 then
    raise exception 'Invalid bank sender' using errcode='22023';
  end if;

  insert into public.taza_phone_sms_receipts(phone,amount,message_hash,sender)
  values (p_phone,p_amount,p_message_hash,p_sender)
  on conflict (message_hash) do nothing
  returning id into v_receipt_id;

  if v_receipt_id is null then
    return query select 'duplicate'::text, null::bigint, null::text;
    return;
  end if;

  insert into public.taza_phone_grants(site_id,phone,access_type,film_id,active)
  values ('taza',p_phone,case when p_amount=12000 then 'all' else 'single' end,null,true)
  on conflict (site_id,phone) do update
  set access_type=case
        -- A smaller payment must never downgrade an active all-film grant.
        when public.taza_phone_grants.active and public.taza_phone_grants.access_type='all'
             and excluded.access_type='single' then 'all'
        else excluded.access_type end,
      film_id=null,
      active=true,
      updated_at=now()
  returning public.taza_phone_grants.id, public.taza_phone_grants.access_type
  into v_grant_id, v_access_type;

  -- Previously issued browser sessions may belong to a different person who
  -- typed this number: payment reissuance always revokes all earlier sessions.
  delete from public.taza_phone_sessions where taza_phone_sessions.grant_id=v_grant_id;

  update public.taza_phone_sms_receipts
    set grant_id=v_grant_id
    where id=v_receipt_id;

  return query select 'granted'::text, v_grant_id, v_access_type;
end;
$function$;

revoke all on function public.kino_taza_phone_confirm_sms(text,integer,text,text) from public,anon,authenticated;
grant execute on function public.kino_taza_phone_confirm_sms(text,integer,text,text) to service_role;

comment on function public.kino_taza_phone_confirm_sms(text,integer,text,text) is
  'Service-role only: idempotently grants one movie for 2k or all movies for 12k after a verified bank SMS. Never expose to browsers.';
comment on table public.taza_phone_sms_receipts is
  'Privacy-protected bank SMS fingerprints and phone grants; duplicate forwarded SMS never grants twice.';
