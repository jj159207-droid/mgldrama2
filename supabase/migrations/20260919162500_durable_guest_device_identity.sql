set local lock_timeout='5s';
set local statement_timeout='30s';

create table if not exists public.guest_device_tokens (
  token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  user_id bigint not null references public.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists guest_device_tokens_user_idx
  on public.guest_device_tokens(user_id);

alter table public.guest_device_tokens enable row level security;
revoke all on public.guest_device_tokens from public,anon,authenticated;
grant select,insert,update,delete on public.guest_device_tokens to service_role;

create or replace function public.kino_merge_guest_account(p_guest bigint,p_user bigint)
returns table(balance bigint)
language plpgsql security invoker set search_path='' as $$
declare
  guest_row public.users;
  user_row public.users;
begin
  if p_guest is null or p_user is null then
    raise exception 'Invalid merge users' using errcode='22023';
  end if;
  if p_guest=p_user then
    return query select coalesce(sum(w.delta),0)::bigint
      from public.wallet_ledger w where w.user_id=p_user;
    return;
  end if;

  perform 1 from public.users
   where id in (p_guest,p_user)
   order by id
   for update;

  select * into guest_row from public.users where id=p_guest;
  select * into user_row from public.users where id=p_user;
  if guest_row.id is null or guest_row.is_guest is not true then
    raise exception 'Source is not a guest' using errcode='P0409';
  end if;
  if user_row.id is null or user_row.is_guest is true then
    raise exception 'Target account invalid' using errcode='P0409';
  end if;

  update public.pending_payments
     set user_id=p_user,
         phone=case when phone like 'guest-%' or phone is null then user_row.phone else phone end
   where user_id=p_guest;

  update public.wallet_ledger set user_id=p_user where user_id=p_guest;
  update public.bank_sms_receipts set user_id=p_user where user_id=p_guest;
  update public.contact_messages set user_id=p_user where user_id=p_guest;
  update public.subscriptions set user_id=p_user::text where user_id=p_guest::text;

  delete from public.push_subscriptions g
   where g.user_id=p_guest
     and exists(select 1 from public.push_subscriptions t where t.user_id=p_user and t.endpoint=g.endpoint);
  update public.push_subscriptions set user_id=p_user where user_id=p_guest;

  if exists(select 1 from public.support_threads where user_id=p_guest) then
    if not exists(select 1 from public.support_threads where user_id=p_user) then
      insert into public.support_threads(
        user_id,updated_at,rate_start,rate_count,user_seen_at,admin_seen_at,user_typing_at,admin_typing_at
      )
      select p_user,updated_at,rate_start,rate_count,user_seen_at,admin_seen_at,user_typing_at,admin_typing_at
      from public.support_threads where user_id=p_guest;
    else
      update public.support_threads t
      set updated_at=greatest(t.updated_at,g.updated_at),
          rate_start=least(t.rate_start,g.rate_start),
          rate_count=greatest(t.rate_count,g.rate_count),
          user_seen_at=case when t.user_seen_at is null then g.user_seen_at when g.user_seen_at is null then t.user_seen_at else greatest(t.user_seen_at,g.user_seen_at) end,
          admin_seen_at=case when t.admin_seen_at is null then g.admin_seen_at when g.admin_seen_at is null then t.admin_seen_at else greatest(t.admin_seen_at,g.admin_seen_at) end,
          user_typing_at=case when t.user_typing_at is null then g.user_typing_at when g.user_typing_at is null then t.user_typing_at else greatest(t.user_typing_at,g.user_typing_at) end,
          admin_typing_at=case when t.admin_typing_at is null then g.admin_typing_at when g.admin_typing_at is null then t.admin_typing_at else greatest(t.admin_typing_at,g.admin_typing_at) end
      from public.support_threads g
      where t.user_id=p_user and g.user_id=p_guest;
    end if;

    delete from public.support_messages g
     where g.user_id=p_guest and g.client_id is not null
       and exists(
         select 1 from public.support_messages t
         where t.user_id=p_user and t.sender=g.sender and t.client_id=g.client_id
       );

    update public.support_messages set user_id=p_user where user_id=p_guest;
    delete from public.support_threads where user_id=p_guest;
  end if;

  update public.guest_device_tokens
     set user_id=p_user,updated_at=clock_timestamp()
   where user_id=p_guest;

  update public.app_sessions set user_id=p_user where user_id=p_guest;

  delete from public.users where id=p_guest;

  return query select coalesce(sum(w.delta),0)::bigint
    from public.wallet_ledger w where w.user_id=p_user;
end $$;

revoke all on function public.kino_merge_guest_account(bigint,bigint)
  from public,anon,authenticated;
grant execute on function public.kino_merge_guest_account(bigint,bigint)
  to service_role;

notify pgrst,'reload schema';
