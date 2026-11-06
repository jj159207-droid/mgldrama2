-- Add TAZA 5-film/10-film passes without invalidating legacy 3-film/6-film claims.
-- New price / plan IDs are checked by the API. Single and all-film do not consume claims.
-- Transactionally claim a film under a confirmed, unexpired package.
-- We serialize all film claims for one user by locking their users row, so
-- concurrent requests cannot consume more slots than paid for.
create or replace function public.kino_taza_claim_film(
  p_user bigint, p_film bigint
) returns table(result text, payment_id bigint)
language plpgsql security definer set search_path = ''
as $$
declare
  purchase record;
  quota integer;
  used integer;
  now_at timestamptz := clock_timestamp();
begin
  if p_user is null or p_user<=0 or p_film is null or p_film<=0 then
    raise exception 'Invalid viewer or film' using errcode='22023';
  end if;
  perform 1 from public.users u where u.id=p_user for update;
  if not found then
    raise exception 'Viewer does not exist' using errcode='22023';
  end if;
  if not exists(select 1 from public.films f where f.id=p_film and f.site_id='taza') then
    return query select 'film_missing'::text,null::bigint; return;
  end if;

  -- Reopening a film that already consumed a slot does not take another slot.
  select p.id into purchase
  from public.taza_pack_claims c
  join public.pending_payments p on p.id=c.payment_id
  where c.user_id=p_user and c.film_id=p_film and c.site_id='taza'
    and p.user_id=p_user and p.site_id='taza' and p.status='confirmed'
    and p.plan in ('pick_3_30d_5000','pick_6_30d_9500','pick_5_30d_6000','pick_10_30d_9000')
    and coalesce(p.confirmed_at,p.created_at) + interval '30 days' > now_at
  order by coalesce(p.confirmed_at,p.created_at),p.id
  limit 1;
  if found then
    return query select 'already_claimed'::text,purchase.id::bigint; return;
  end if;

  for purchase in
    select p.id,p.plan
    from public.pending_payments p
    where p.user_id=p_user and p.site_id='taza' and p.status='confirmed'
      and p.plan in ('pick_3_30d_5000','pick_6_30d_9500','pick_5_30d_6000','pick_10_30d_9000')
      and coalesce(p.confirmed_at,p.created_at) + interval '30 days' > now_at
    order by coalesce(p.confirmed_at,p.created_at),p.id
  loop
    quota := case purchase.plan when 'pick_3_30d_5000' then 3
                                when 'pick_6_30d_9500' then 6
                                when 'pick_5_30d_6000' then 5
                                when 'pick_10_30d_9000' then 10 else 0 end;
    select count(*)::integer into used
    from public.taza_pack_claims c
    where c.payment_id=purchase.id and c.user_id=p_user and c.site_id='taza';
    if used<quota then
      insert into public.taza_pack_claims(site_id,user_id,payment_id,film_id)
      values('taza',p_user,purchase.id,p_film);
      return query select 'claimed'::text,purchase.id::bigint; return;
    end if;
  end loop;

  return query select 'exhausted'::text,null::bigint;
end;
$$;
revoke all on function public.kino_taza_claim_film(bigint,bigint) from public,anon,authenticated;
grant execute on function public.kino_taza_claim_film(bigint,bigint) to service_role;

