-- Preserve prepaid balance and single-movie rights when a device guest
-- later signs in or creates a real phone/PIN account.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function public.kino_merge_guest_account(p_guest bigint,p_user bigint)
returns table(balance bigint)
language plpgsql security invoker set search_path = '' as $$
declare
  guest_row public.users;
  user_row public.users;
begin
  if p_guest is null or p_user is null or p_guest=p_user then
    return query select coalesce(sum(w.delta),0)::bigint
      from public.wallet_ledger w where w.user_id=p_user;
    return;
  end if;

  -- Lock in ID order so two concurrent sign-ins cannot deadlock.
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

  update public.wallet_ledger
     set user_id=p_user
   where user_id=p_guest;

  return query select coalesce(sum(w.delta),0)::bigint
    from public.wallet_ledger w where w.user_id=p_user;
end $$;

revoke all on function public.kino_merge_guest_account(bigint,bigint) from public,anon,authenticated;
grant execute on function public.kino_merge_guest_account(bigint,bigint) to service_role;
notify pgrst,'reload schema';
