-- Track users who reach the payment/top-up section after pressing full movie watch.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.site_events
  drop constraint if exists site_events_event_type_check;

alter table public.site_events
  add constraint site_events_event_type_check
  check (event_type in ('visit','film_open','watch_click','payment_open','play_start'));

create or replace function public.kino_analytics_summary(p_days integer default 30)
returns table(summary jsonb)
language sql stable security invoker set search_path = '' as $$
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
top_films as (
  select e.film_id,coalesce(f.title,'#'||e.film_id::text) title,
    count(*) filter(where e.event_type='film_open')::bigint opens,
    count(*) filter(where e.event_type='watch_click')::bigint watch_clicks,
    count(*) filter(where e.event_type='payment_open')::bigint payment_opens,
    count(*) filter(where e.event_type='play_start')::bigint play_starts
  from period_events e
  left join public.films f on f.id=e.film_id
  where e.film_id is not null
  group by e.film_id,f.title
  having count(*) filter(where e.event_type in ('film_open','watch_click','payment_open','play_start'))>0
  order by payment_opens desc,play_starts desc,watch_clicks desc,opens desc,e.film_id desc
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
    (select count(distinct e.visitor_key) from public.site_events e
      where e.event_type='visit'
        and e.created_at >= (x.day_date::timestamp at time zone 'Asia/Ulaanbaatar')
        and e.created_at < ((x.day_date+1)::timestamp at time zone 'Asia/Ulaanbaatar'))::bigint visitors,
    (select count(*) from public.site_events e
      where e.event_type='watch_click'
        and e.created_at >= (x.day_date::timestamp at time zone 'Asia/Ulaanbaatar')
        and e.created_at < ((x.day_date+1)::timestamp at time zone 'Asia/Ulaanbaatar'))::bigint watch_clicks,
    (select count(*) from public.site_events e
      where e.event_type='payment_open'
        and e.created_at >= (x.day_date::timestamp at time zone 'Asia/Ulaanbaatar')
        and e.created_at < ((x.day_date+1)::timestamp at time zone 'Asia/Ulaanbaatar'))::bigint payment_opens,
    (select count(*) from public.site_events e
      where e.event_type='play_start'
        and e.created_at >= (x.day_date::timestamp at time zone 'Asia/Ulaanbaatar')
        and e.created_at < ((x.day_date+1)::timestamp at time zone 'Asia/Ulaanbaatar'))::bigint play_starts,
    (select coalesce(sum(w.delta),0) from public.wallet_ledger w
      where w.kind='topup'
        and w.created_at >= (x.day_date::timestamp at time zone 'Asia/Ulaanbaatar')
        and w.created_at < ((x.day_date+1)::timestamp at time zone 'Asia/Ulaanbaatar'))::bigint topup_amount
  from daily_days x
)
select jsonb_build_object(
  'days',(select days from bounds),
  'resetAt',(select reset_at from bounds),
  'today',jsonb_build_object(
    'visits',(select count(*) from public.site_events e,bounds b where e.event_type='visit' and e.created_at>=b.today_start),
    'uniqueVisitors',(select count(distinct e.visitor_key) from public.site_events e,bounds b where e.event_type='visit' and e.created_at>=b.today_start),
    'newBrowsers',(select count(*) from public.users u,bounds b where u.created_at>=b.today_start),
    'filmOpens',(select count(*) from public.site_events e,bounds b where e.event_type='film_open' and e.created_at>=b.today_start),
    'watchClicks',(select count(*) from public.site_events e,bounds b where e.event_type='watch_click' and e.created_at>=b.today_start),
    'uniqueWatchers',(select count(distinct e.visitor_key) from public.site_events e,bounds b where e.event_type='watch_click' and e.created_at>=b.today_start),
    'paymentOpens',(select count(*) from public.site_events e,bounds b where e.event_type='payment_open' and e.created_at>=b.today_start),
    'uniquePaymentVisitors',(select count(distinct e.visitor_key) from public.site_events e,bounds b where e.event_type='payment_open' and e.created_at>=b.today_start),
    'playStarts',(select count(*) from public.site_events e,bounds b where e.event_type='play_start' and e.created_at>=b.today_start),
    'uniquePlayers',(select count(distinct e.visitor_key) from public.site_events e,bounds b where e.event_type='play_start' and e.created_at>=b.today_start),
    'facebookVisits',(select count(*) from public.site_events e,bounds b where e.event_type='visit' and e.source='facebook' and e.created_at>=b.today_start),
    'topupCount',(select count(*) from public.wallet_ledger w,bounds b where w.kind='topup' and w.created_at>=b.today_start),
    'topupAmount',(select coalesce(sum(w.delta),0) from public.wallet_ledger w,bounds b where w.kind='topup' and w.created_at>=b.today_start),
    'adminCreditAmount',(select coalesce(sum(w.delta),0) from public.wallet_ledger w,bounds b where w.kind='admin_credit' and w.created_at>=b.today_start),
    'spentAmount',(select coalesce(-sum(w.delta),0) from public.wallet_ledger w,bounds b where w.kind='purchase' and w.created_at>=b.today_start)
  ),
  'period',jsonb_build_object(
    'visits',(select count(*) from period_events where event_type='visit'),
    'uniqueVisitors',(select count(distinct visitor_key) from period_events where event_type='visit'),
    'newBrowsers',(select count(*) from public.users u,bounds b where u.created_at>=b.period_start),
    'totalBrowsersSinceReset',(select count(*) from public.users u,bounds b where u.created_at>=b.reset_at),
    'filmOpens',(select count(*) from period_events where event_type='film_open'),
    'watchClicks',(select count(*) from period_events where event_type='watch_click'),
    'uniqueWatchers',(select count(distinct visitor_key) from period_events where event_type='watch_click'),
    'paymentOpens',(select count(*) from period_events where event_type='payment_open'),
    'uniquePaymentVisitors',(select count(distinct visitor_key) from period_events where event_type='payment_open'),
    'playStarts',(select count(*) from period_events where event_type='play_start'),
    'uniquePlayers',(select count(distinct visitor_key) from period_events where event_type='play_start'),
    'facebookVisits',(select count(*) from period_events where event_type='visit' and source='facebook'),
    'directVisits',(select count(*) from period_events where event_type='visit' and source='direct'),
    'otherVisits',(select count(*) from period_events where event_type='visit' and source='other'),
    'topupCount',(select count(*) from public.wallet_ledger w,bounds b where w.kind='topup' and w.created_at>=b.period_start),
    'topupAmount',(select coalesce(sum(w.delta),0) from public.wallet_ledger w,bounds b where w.kind='topup' and w.created_at>=b.period_start),
    'adminCreditAmount',(select coalesce(sum(w.delta),0) from public.wallet_ledger w,bounds b where w.kind='admin_credit' and w.created_at>=b.period_start),
    'spentAmount',(select coalesce(-sum(w.delta),0) from public.wallet_ledger w,bounds b where w.kind='purchase' and w.created_at>=b.period_start),
    'filmPurchases',(select count(*) from public.wallet_ledger w,bounds b where w.kind='purchase' and w.film_id is not null and w.created_at>=b.period_start),
    'packagePurchases',(select count(*) from public.wallet_ledger w,bounds b where w.kind='purchase' and w.film_id is null and w.created_at>=b.period_start),
    'payingUsers',(select count(distinct w.user_id) from public.wallet_ledger w,bounds b where w.kind='topup' and w.created_at>=b.period_start),
    'pendingTopups',(select count(*) from public.pending_payments p,bounds b where p.plan='wallet_topup' and p.status='pending' and p.created_at>=b.reset_at),
    'pushEnabledUsers',(select count(distinct s.user_id) from public.push_subscriptions s),
    'visitorToWatchPct',(select case when count(distinct visitor_key)=0 then 0 else round(100.0*count(*) filter(where event_type='watch_click')/count(distinct visitor_key),1) end from period_events),
    'watchToPaymentPct',(select case when count(*) filter(where event_type='watch_click')=0 then 0 else round(100.0*count(*) filter(where event_type='payment_open')/count(*) filter(where event_type='watch_click'),1) end from period_events),
    'paymentToPlayPct',(select case when count(*) filter(where event_type='payment_open')=0 then 0 else round(100.0*count(*) filter(where event_type='play_start')/count(*) filter(where event_type='payment_open'),1) end from period_events),
    'watchToPlayPct',(select case when count(*) filter(where event_type='watch_click')=0 then 0 else round(100.0*count(*) filter(where event_type='play_start')/count(*) filter(where event_type='watch_click'),1) end from period_events)
  ),
  'topFilms',coalesce((select jsonb_agg(to_jsonb(t)) from top_films t),'[]'::jsonb),
  'daily',coalesce((select jsonb_agg(to_jsonb(d) order by d.day_date) from daily d),'[]'::jsonb)
);
$$;

revoke all on function public.kino_analytics_summary(integer) from public,anon,authenticated;
grant execute on function public.kino_analytics_summary(integer) to service_role;

notify pgrst,'reload schema';
