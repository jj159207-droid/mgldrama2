-- Harden wallet-topup creation and make analytics reset/conversion exact.

create or replace function public.kino_wallet_prepare_topup(
  p_user bigint,
  p_amount integer,
  p_ref text
)
returns table(
  id bigint,
  ref_code text,
  user_id bigint,
  film_id bigint,
  plan text,
  amount integer,
  status text,
  created_at timestamptz,
  confirmed_at timestamptz
)
language plpgsql
set search_path to ''
as $$
declare
  saved public.pending_payments;
  owner public.users;
begin
  if p_user is null or p_amount is null or p_amount < 5000 or p_amount > 200000
     or p_amount % 1000 <> 0 or p_ref !~ '^\d{6}$' then
    raise exception 'Invalid wallet topup request' using errcode='22023';
  end if;

  select * into owner from public.users where users.id=p_user for update;
  if not found then raise exception 'Unknown user' using errcode='P0404'; end if;

  select * into saved
  from public.pending_payments p
  where p.user_id=p_user
    and p.plan='wallet_topup'
    and p.amount=p_amount
    and p.status='pending'
    and p.created_at>=now()-interval '24 hours'
  order by p.created_at desc
  limit 1
  for update;

  if not found then
    if exists(select 1 from public.pending_payments p where p.ref_code=p_ref) then
      raise exception 'Reference conflict' using errcode='P0409';
    end if;

    insert into public.pending_payments(ref_code,user_id,phone,film_id,plan,amount,status)
    values(p_ref,p_user,owner.phone,null,'wallet_topup',p_amount,'pending')
    returning * into saved;
  end if;

  return query
  select saved.id,saved.ref_code,saved.user_id,saved.film_id,saved.plan,
         saved.amount,saved.status,saved.created_at,saved.confirmed_at;
end $$;

revoke all on function public.kino_wallet_prepare_topup(bigint,integer,text) from public,anon,authenticated;
grant execute on function public.kino_wallet_prepare_topup(bigint,integer,text) to service_role;

create or replace function public.kino_analytics_summary(p_days integer default 30)
returns table(summary jsonb)
language sql
stable
set search_path to ''
as $$
with cfg as (
  select coalesce((select s.reset_at from public.analytics_state s where s.id=1),'1970-01-01 00:00:00+00'::timestamptz) reset_at
),
bounds as (
  select
    greatest(1,least(coalesce(p_days,30),365))::int as days,
    c.reset_at,
    greatest(c.reset_at,now()-make_interval(days=>greatest(1,least(coalesce(p_days,30),365)))) as period_start,
    greatest(c.reset_at,(date_trunc('day',now() at time zone 'Asia/Ulaanbaatar') at time zone 'Asia/Ulaanbaatar')) as today_start
  from cfg c
),
period_events as (
  select e.* from public.site_events e,bounds b where e.created_at>=b.period_start
),
active_rights as (
  select p.user_id
  from public.pending_payments p
  where p.status='confirmed'
    and p.plan not in ('wallet_topup','wallet_admin')
    and (
      case
        when p.plan='single' then coalesce(p.confirmed_at,p.created_at)+interval '3 days'
        when p.plan='3day' or p.plan like '%_3day' then coalesce(p.confirmed_at,p.created_at)+interval '3 days'
        when p.plan='1year' then coalesce(p.confirmed_at,p.created_at)+interval '365 days'
        else coalesce(p.confirmed_at,p.created_at)+interval '30 days'
      end
    ) > now()
  group by p.user_id
),
top_films as (
  select e.film_id,coalesce(f.title,'#'||e.film_id::text) title,
    count(*) filter(where e.event_type='film_open')::bigint opens,
    count(*) filter(where e.event_type='watch_click')::bigint watch_clicks,
    count(*) filter(where e.event_type='play_start')::bigint play_starts
  from period_events e
  left join public.films f on f.id=e.film_id
  where e.film_id is not null
  group by e.film_id,f.title
  having count(*) filter(where e.event_type in ('film_open','watch_click','play_start'))>0
  order by play_starts desc,watch_clicks desc,opens desc,e.film_id desc
  limit 20
),
daily_days as (
  select d::date as day_date
  from bounds b,
  lateral generate_series(
    greatest(
      (b.period_start at time zone 'Asia/Ulaanbaatar')::date,
      (now() at time zone 'Asia/Ulaanbaatar')::date - 29
    ),
    (now() at time zone 'Asia/Ulaanbaatar')::date,
    interval '1 day'
  ) d
),
daily as (
  select x.day_date,
    (select count(distinct e.visitor_key) from public.site_events e,bounds b
      where e.event_type='visit'
        and e.created_at >= greatest((x.day_date::timestamp at time zone 'Asia/Ulaanbaatar'),b.period_start)
        and e.created_at < ((x.day_date+1)::timestamp at time zone 'Asia/Ulaanbaatar'))::bigint visitors,
    (select count(*) from public.site_events e,bounds b
      where e.event_type='watch_click'
        and e.created_at >= greatest((x.day_date::timestamp at time zone 'Asia/Ulaanbaatar'),b.period_start)
        and e.created_at < ((x.day_date+1)::timestamp at time zone 'Asia/Ulaanbaatar'))::bigint watch_clicks,
    (select count(*) from public.site_events e,bounds b
      where e.event_type='play_start'
        and e.created_at >= greatest((x.day_date::timestamp at time zone 'Asia/Ulaanbaatar'),b.period_start)
        and e.created_at < ((x.day_date+1)::timestamp at time zone 'Asia/Ulaanbaatar'))::bigint play_starts,
    (select coalesce(sum(w.delta),0) from public.wallet_ledger w,bounds b
      where w.kind='topup'
        and w.created_at >= greatest((x.day_date::timestamp at time zone 'Asia/Ulaanbaatar'),b.period_start)
        and w.created_at < ((x.day_date+1)::timestamp at time zone 'Asia/Ulaanbaatar'))::bigint topup_amount
  from daily_days x
)
select jsonb_build_object(
  'days',(select days from bounds),
  'resetAt',(select reset_at from bounds),
  'today',jsonb_build_object(
    'visits',(select count(*) from public.site_events e,bounds b where e.event_type='visit' and e.created_at>=b.today_start),
    'uniqueVisitors',(select count(distinct e.visitor_key) from public.site_events e,bounds b where e.event_type='visit' and e.created_at>=b.today_start),
    'uniqueWatchers',(select count(distinct e.visitor_key) from public.site_events e,bounds b where e.event_type='watch_click' and e.created_at>=b.today_start),
    'uniquePlayers',(select count(distinct e.visitor_key) from public.site_events e,bounds b where e.event_type='play_start' and e.created_at>=b.today_start),
    'newBrowsers',(select count(*) from public.users u,bounds b where u.created_at>=b.today_start),
    'filmOpens',(select count(*) from public.site_events e,bounds b where e.event_type='film_open' and e.created_at>=b.today_start),
    'watchClicks',(select count(*) from public.site_events e,bounds b where e.event_type='watch_click' and e.created_at>=b.today_start),
    'playStarts',(select count(*) from public.site_events e,bounds b where e.event_type='play_start' and e.created_at>=b.today_start),
    'facebookVisits',(select count(*) from public.site_events e,bounds b where e.event_type='visit' and e.source='facebook' and e.created_at>=b.today_start),
    'topupCount',(select count(*) from public.wallet_ledger w,bounds b where w.kind='topup' and w.created_at>=b.today_start),
    'topupAmount',(select coalesce(sum(w.delta),0) from public.wallet_ledger w,bounds b where w.kind='topup' and w.created_at>=b.today_start),
    'adminCreditAmount',(select coalesce(sum(w.delta),0) from public.wallet_ledger w,bounds b where w.kind='admin_credit' and w.created_at>=b.today_start),
    'spentAmount',(select coalesce(-sum(w.delta),0) from public.wallet_ledger w,bounds b where w.kind='purchase' and w.created_at>=b.today_start)
  ),
  'period',jsonb_build_object(
    'visits',(select count(*) from period_events where event_type='visit'),
    'uniqueVisitors',(select count(distinct visitor_key) from period_events where event_type='visit'),
    'uniqueWatchers',(select count(distinct visitor_key) from period_events where event_type='watch_click'),
    'uniquePlayers',(select count(distinct visitor_key) from period_events where event_type='play_start'),
    'newBrowsers',(select count(*) from public.users u,bounds b where u.created_at>=b.period_start),
    'totalBrowsersSinceReset',(select count(*) from public.users u,bounds b where u.created_at>=b.reset_at),
    'activeRightsUsers',(select count(*) from active_rights),
    'filmOpens',(select count(*) from period_events where event_type='film_open'),
    'watchClicks',(select count(*) from period_events where event_type='watch_click'),
    'playStarts',(select count(*) from period_events where event_type='play_start'),
    'facebookVisits',(select count(*) from period_events where event_type='visit' and source='facebook'),
    'directVisits',(select count(*) from period_events where event_type='visit' and source='direct'),
    'otherVisits',(select count(*) from period_events where event_type='visit' and source='other'),
    'topupCount',(select count(*) from public.wallet_ledger w,bounds b where w.kind='topup' and w.created_at>=b.period_start),
    'topupAmount',(select coalesce(sum(w.delta),0) from public.wallet_ledger w,bounds b where w.kind='topup' and w.created_at>=b.period_start),
    'avgTopupAmount',(select coalesce(round(avg(w.delta))::bigint,0) from public.wallet_ledger w,bounds b where w.kind='topup' and w.created_at>=b.period_start),
    'adminCreditAmount',(select coalesce(sum(w.delta),0) from public.wallet_ledger w,bounds b where w.kind='admin_credit' and w.created_at>=b.period_start),
    'spentAmount',(select coalesce(-sum(w.delta),0) from public.wallet_ledger w,bounds b where w.kind='purchase' and w.created_at>=b.period_start),
    'walletBalanceOutstanding',(select coalesce(sum(w.delta),0) from public.wallet_ledger w),
    'filmPurchases',(select count(*) from public.wallet_ledger w,bounds b where w.kind='purchase' and w.film_id is not null and w.created_at>=b.period_start),
    'packagePurchases',(select count(*) from public.wallet_ledger w,bounds b where w.kind='purchase' and w.film_id is null and w.created_at>=b.period_start),
    'payingUsers',(select count(distinct w.user_id) from public.wallet_ledger w,bounds b where w.kind='topup' and w.created_at>=b.period_start),
    'pendingTopups',(select count(distinct (p.user_id,p.amount)) from public.pending_payments p,bounds b where p.plan='wallet_topup' and p.status='pending' and p.created_at>=b.reset_at and p.created_at>=now()-interval '24 hours'),
    'pushEnabledUsers',(select count(distinct s.user_id) from public.push_subscriptions s),
    'autoSmsConfirmed',(select count(*) from public.sms_webhook_events e,bounds b where e.outcome='wallet_confirmed' and e.created_at>=b.period_start),
    'smsFailures',(select count(*) from public.sms_webhook_events e,bounds b where e.outcome in ('parse_failed','sender_rejected','amount_rejected','amount_mismatch','payment_not_found','wallet_error','server_error','state_changed','payment_expired','payment_not_pending') and e.created_at>=b.period_start),
    'visitorToWatchPct',(select case
      when count(distinct visitor_key) filter(where event_type='visit')=0 then 0
      else round(100.0*(count(distinct visitor_key) filter(where event_type='watch_click'))/(count(distinct visitor_key) filter(where event_type='visit')),1)
      end from period_events),
    'watchToPlayPct',(select case
      when count(distinct visitor_key) filter(where event_type='watch_click')=0 then 0
      else round(100.0*(count(distinct visitor_key) filter(where event_type='play_start'))/(count(distinct visitor_key) filter(where event_type='watch_click')),1)
      end from period_events)
  ),
  'topFilms',coalesce((select jsonb_agg(to_jsonb(t)) from top_films t),'[]'::jsonb),
  'daily',coalesce((select jsonb_agg(to_jsonb(d) order by d.day_date) from daily d),'[]'::jsonb)
);
$$;

revoke all on function public.kino_analytics_summary(integer) from public,anon,authenticated;
grant execute on function public.kino_analytics_summary(integer) to service_role;

notify pgrst,'reload schema';
