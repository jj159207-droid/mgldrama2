-- TAZA entry paywall: returning payers and currently granted users keep access.
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
    from public.wallet_ledger w
    where w.user_id=p_user
      and w.site_id=p_site
      and w.delta>0
      and w.kind in ('topup','admin_credit')
  ) then
    return query select true,'wallet_funded'::text;
    return;
  end if;

  if exists(
    select 1
    from public.pending_payments p
    where p.user_id=p_user
      and p.site_id=p_site
      and p.status='confirmed'
      and p.amount>0
  ) then
    return query select true,'legacy_payment'::text;
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
          when p.plan='single' or p.plan='3day' or p.plan like '%_3day' then interval '3 days'
          when p.plan='1year' then interval '365 days'
          else interval '30 days'
        end > now()
  ) then
    return query select true,'active_grant'::text;
    return;
  end if;

  return query select false,'payment_required'::text;
end $$;

revoke all on function public.kino_site_entry_status(bigint,text) from public,anon,authenticated;
grant execute on function public.kino_site_entry_status(bigint,text) to service_role;
notify pgrst,'reload schema';
