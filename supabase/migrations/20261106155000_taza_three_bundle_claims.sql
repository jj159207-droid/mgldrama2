-- TAZA film-credit bundles: 3 films for 5,000₮ or 6 for 9,500₮ over 30 days.
-- Requires a separate migration on TAZA's Supabase project before enabling this feature.
-- One distinct film occupies one credit; it can be replayed during its pack's validity.
create table if not exists public.taza_pack_claims (
  id bigint generated always as identity primary key,
  site_id text not null default 'taza' check (site_id='taza'),
  user_id bigint not null references public.users(id),
  payment_id bigint not null references public.pending_payments(id),
  film_id bigint not null references public.films(id),
  claimed_at timestamptz not null default now(),
  unique (payment_id,film_id)
);
create index if not exists taza_pack_claims_user_payment_idx
  on public.taza_pack_claims(user_id,payment_id,id);
create index if not exists taza_pack_claims_user_film_idx
  on public.taza_pack_claims(user_id,film_id);

alter table public.taza_pack_claims enable row level security;
revoke all on table public.taza_pack_claims from public, anon, authenticated;
grant select,insert on table public.taza_pack_claims to service_role;
revoke all on sequence public.taza_pack_claims_id_seq from public,anon,authenticated;
grant usage,select on sequence public.taza_pack_claims_id_seq to service_role;

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
    and p.plan in ('pick_3_30d_5000','pick_6_30d_9500')
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
      and p.plan in ('pick_3_30d_5000','pick_6_30d_9500')
      and coalesce(p.confirmed_at,p.created_at) + interval '30 days' > now_at
    order by coalesce(p.confirmed_at,p.created_at),p.id
  loop
    quota := case purchase.plan when 'pick_3_30d_5000' then 3
                                when 'pick_6_30d_9500' then 6 else 0 end;
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

-- Claims can be inspected through the server service-role only; consumers never
-- receive direct table or RPC permissions. The server validates their session.
