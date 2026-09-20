create or replace function public.kino_analytics_reset_site(p_site text)
returns table(reset_at timestamptz)
language plpgsql
set search_path=''
as $$
declare stamp timestamptz:=clock_timestamp();
begin
  if p_site not in ('taza','kino-drama','kinochid','fire') then
    raise exception 'Invalid site' using errcode='22023';
  end if;
  insert into public.site_analytics_state(site_id,reset_at,updated_at)
  values(p_site,stamp,stamp)
  on conflict(site_id) do update set reset_at=excluded.reset_at,updated_at=excluded.updated_at;
  return query select stamp;
end $$;

create or replace function public.kino_analytics_summary_site(p_site text,p_days integer default 30)
returns table(summary jsonb)
language sql
stable
set search_path=''
as $$
with cfg as (
  select coalesce(
    (select s.reset_at from public.site_analytics_state s where s.site_id=p_site),
    '1970-01-01 00:00:00+00'::timestamptz
  ) reset_at
  where p_site in ('taza','kino-drama','kinochid','fire')
),
bounds as (
  select greatest(1,least(coalesce(p_days,30),365))::int days,c.reset_at,
    greatest(c.reset_at,now()-make_interval(days=>greatest(1,least(coalesce(p_days,30),365)))) period_start,
    greatest(c.reset_at,(date_trunc('day',now() at time zone 'Asia/Ulaanbaatar') at time zone 'Asia/Ulaanbaatar')) today_start
  from cfg c
),
period_events as (
  select e.* from public.site_events e,bounds b
  where e.site_id=p_site and e.created_at>=b.period_start
),
top_films as (
  select e.film_id,coalesce(f.title,'#'||e.film_id::text) title,
    count(*) filter(where e.event_type='film_open')::bigint opens,
    count(*) filter(where e.event_type='watch_click')::bigint watch_clicks,
    count(*) filter(where e.event_type='payment_open')::bigint payment_opens,
    count(*) filter(where e.event_type='play_start')::bigint play_starts
  from period_events e
  left join public.films f on f.id=e.film_id and f.site_id=p_site
  where e.film_id is not null
  group by e.film_id,f.title
  having count(*) filter(where e.event_type in ('film_open','watch_click','payment_open','play_start'))>0
  order by payment_opens desc,play_starts desc,watch_clicks desc,opens desc,e.film_id desc
  limit 20
),
daily_days as (
  select d::date day_date
  from bounds b,lateral generate_series(
    greatest((b.period_start at time zone 'Asia/Ulaanbaatar')::date,(now() at time zone 'Asia/Ulaanbaatar')::date-29),
    (now() at time zone 'Asia/Ulaanbaatar')::date,interval '1 day'
  ) d
),
daily as (
  select x.day_date,
    (select count(distinct e.visitor_key) from public.site_events e
      where e.site_id=p_site and e.event_type='visit'
      and e.created_at >= (x.day_date::timestamp at time zone 'Asia/Ulaanbaatar')
      and e.created_at < ((x.day_date+1)::timestamp at time zone 'Asia/Ulaanbaatar'))::bigint visitors,
    (select count(*) from public.site_events e
      where e.site_id=p_site and e.event_type='watch_click'
      and e.created_at >= (x.day_date::timestamp at time zone 'Asia/Ulaanbaatar')
      and e.created_at < ((x.day_date+1)::timestamp at time zone 'Asia/Ulaanbaatar'))::bigint watch_clicks,
    (select count(*) from public.site_events e
      where e.site_id=p_site and e.event_type='play_start'
      and e.created_at >= (x.day_date::timestamp at time zone 'Asia/Ulaanbaatar')
      and e.created_at < ((x.day_date+1)::timestamp at time zone 'Asia/Ulaanbaatar'))::bigint play_starts,
    (select coalesce(sum(w.delta),0) from public.wallet_ledger w
      where w.site_id=p_site and w.kind='topup'
      and w.created_at >= (x.day_date::timestamp at time zone 'Asia/Ulaanbaatar')
      and w.created_at < ((x.day_date+1)::timestamp at time zone 'Asia/Ulaanbaatar'))::bigint topup_amount
  from daily_days x
),
active_rights as (
  select distinct p.user_id
  from public.pending_payments p
  where p.site_id=p_site and p.status='confirmed' and p.plan<>'wallet_topup'
    and coalesce(p.confirmed_at,p.created_at)+
      case
        when p.plan='single' or p.plan='3day' or p.plan like '%_3day' then interval '3 days'
        when p.plan='1year' then interval '365 days'
        else interval '30 days'
      end > now()
),
sms_period as (
  select e.*
  from public.sms_webhook_events e
  join public.pending_payments p on p.ref_code=e.ref_code and p.site_id=p_site
  join bounds b on e.created_at>=b.period_start
)
select jsonb_build_object(
  'days',(select days from bounds),
  'resetAt',(select reset_at from bounds),
  'site',p_site,
  'today',jsonb_build_object(
    'visits',(select count(*) from public.site_events e,bounds b where e.site_id=p_site and e.event_type='visit' and e.created_at>=b.today_start),
    'uniqueVisitors',(select count(distinct e.visitor_key) from public.site_events e,bounds b where e.site_id=p_site and e.event_type='visit' and e.created_at>=b.today_start),
    'newBrowsers',(select count(*) from public.site_user_memberships m,bounds b where m.site_id=p_site and m.first_seen_at>=b.today_start),
    'filmOpens',(select count(*) from public.site_events e,bounds b where e.site_id=p_site and e.event_type='film_open' and e.created_at>=b.today_start),
    'watchClicks',(select count(*) from public.site_events e,bounds b where e.site_id=p_site and e.event_type='watch_click' and e.created_at>=b.today_start),
    'uniqueWatchers',(select count(distinct e.visitor_key) from public.site_events e,bounds b where e.site_id=p_site and e.event_type='watch_click' and e.created_at>=b.today_start),
    'paymentOpens',(select count(*) from public.site_events e,bounds b where e.site_id=p_site and e.event_type='payment_open' and e.created_at>=b.today_start),
    'uniquePaymentVisitors',(select count(distinct e.visitor_key) from public.site_events e,bounds b where e.site_id=p_site and e.event_type='payment_open' and e.created_at>=b.today_start),
    'bankAccountCopies',(select count(*) from public.site_events e,bounds b where e.site_id=p_site and e.event_type='bank_account_copy' and e.created_at>=b.today_start),
    'uniqueBankCopyVisitors',(select count(distinct e.visitor_key) from public.site_events e,bounds b where e.site_id=p_site and e.event_type='bank_account_copy' and e.created_at>=b.today_start),
    'refCodeCopies',(select count(*) from public.site_events e,bounds b where e.site_id=p_site and e.event_type='ref_code_copy' and e.created_at>=b.today_start),
    'uniqueRefCopyVisitors',(select count(distinct e.visitor_key) from public.site_events e,bounds b where e.site_id=p_site and e.event_type='ref_code_copy' and e.created_at>=b.today_start),
    'playStarts',(select count(*) from public.site_events e,bounds b where e.site_id=p_site and e.event_type='play_start' and e.created_at>=b.today_start),
    'uniquePlayers',(select count(distinct e.visitor_key) from public.site_events e,bounds b where e.site_id=p_site and e.event_type='play_start' and e.created_at>=b.today_start),
    'facebookVisits',(select count(*) from public.site_events e,bounds b where e.site_id=p_site and e.event_type='visit' and e.source='facebook' and e.created_at>=b.today_start),
    'topupCount',(select count(*) from public.wallet_ledger w,bounds b where w.site_id=p_site and w.kind='topup' and w.created_at>=b.today_start),
    'topupAmount',(select coalesce(sum(w.delta),0) from public.wallet_ledger w,bounds b where w.site_id=p_site and w.kind='topup' and w.created_at>=b.today_start)
  ),
  'period',jsonb_build_object(
    'visits',(select count(*) from period_events where event_type='visit'),
    'uniqueVisitors',(select count(distinct visitor_key) from period_events where event_type='visit'),
    'newBrowsers',(select count(*) from public.site_user_memberships m,bounds b where m.site_id=p_site and m.first_seen_at>=b.period_start),
    'totalBrowsersSinceReset',(select count(*) from public.site_user_memberships m,bounds b where m.site_id=p_site and m.first_seen_at>=b.reset_at),
    'payingUsers',(select count(distinct w.user_id) from public.wallet_ledger w,bounds b where w.site_id=p_site and w.kind='topup' and w.created_at>=b.period_start),
    'activeRightsUsers',(select count(*) from active_rights),
    'topupCount',(select count(*) from public.wallet_ledger w,bounds b where w.site_id=p_site and w.kind='topup' and w.created_at>=b.period_start),
    'topupAmount',(select coalesce(sum(w.delta),0) from public.wallet_ledger w,bounds b where w.site_id=p_site and w.kind='topup' and w.created_at>=b.period_start),
    'avgTopupAmount',(select coalesce(round(avg(w.delta)),0) from public.wallet_ledger w,bounds b where w.site_id=p_site and w.kind='topup' and w.created_at>=b.period_start),
    'adminCreditAmount',(select coalesce(sum(w.delta),0) from public.wallet_ledger w,bounds b where w.site_id=p_site and w.kind='admin_credit' and w.created_at>=b.period_start),
    'spentAmount',(select coalesce(-sum(w.delta),0) from public.wallet_ledger w,bounds b where w.site_id=p_site and w.kind='purchase' and w.created_at>=b.period_start),
    'walletBalanceOutstanding',(select coalesce(sum(w.delta),0) from public.wallet_ledger w where w.site_id=p_site),
    'filmPurchases',(select count(*) from public.wallet_ledger w,bounds b where w.site_id=p_site and w.kind='purchase' and w.film_id is not null and w.created_at>=b.period_start),
    'packagePurchases',(select count(*) from public.wallet_ledger w,bounds b where w.site_id=p_site and w.kind='purchase' and w.film_id is null and w.created_at>=b.period_start),
    'pendingTopups',(select count(*) from public.pending_payments p,bounds b where p.site_id=p_site and p.plan='wallet_topup' and p.status='pending' and p.created_at>=b.reset_at),
    'pushEnabledUsers',(select count(distinct s.user_id) from public.push_subscriptions s where s.site_id=p_site),
    'autoSmsConfirmed',(select count(*) from sms_period where outcome in ('wallet_confirmed','confirmed')),
    'smsFailures',(select count(*) from sms_period where outcome in ('parse_failed','sender_rejected','amount_rejected','amount_mismatch','payment_not_found','payment_expired','wallet_error','server_error','state_changed')),
    'paymentOpens',(select count(*) from period_events where event_type='payment_open'),
    'uniquePaymentVisitors',(select count(distinct visitor_key) from period_events where event_type='payment_open'),
    'bankAccountCopies',(select count(*) from period_events where event_type='bank_account_copy'),
    'uniqueBankCopyVisitors',(select count(distinct visitor_key) from period_events where event_type='bank_account_copy'),
    'refCodeCopies',(select count(*) from period_events where event_type='ref_code_copy'),
    'uniqueRefCopyVisitors',(select count(distinct visitor_key) from period_events where event_type='ref_code_copy'),
    'visitorToWatchPct',(select case when count(distinct visitor_key)=0 then 0 else round(100.0*count(*) filter(where event_type='watch_click')/count(distinct visitor_key),1) end from period_events),
    'watchToPaymentPct',(select case when count(*) filter(where event_type='watch_click')=0 then 0 else round(100.0*count(*) filter(where event_type='payment_open')/count(*) filter(where event_type='watch_click'),1) end from period_events),
    'paymentToPlayPct',(select case when count(*) filter(where event_type='payment_open')=0 then 0 else round(100.0*count(*) filter(where event_type='play_start')/count(*) filter(where event_type='payment_open'),1) end from period_events),
    'watchToPlayPct',(select case when count(distinct visitor_key) filter(where event_type='watch_click')=0 then 0 else round(100.0*count(distinct visitor_key) filter(where event_type='play_start')/count(distinct visitor_key) filter(where event_type='watch_click'),1) end from period_events)
  ),
  'topFilms',coalesce((select jsonb_agg(to_jsonb(t)) from top_films t),'[]'::jsonb),
  'daily',coalesce((select jsonb_agg(to_jsonb(d) order by d.day_date) from daily d),'[]'::jsonb)
);
$$;

revoke all on function public.kino_analytics_reset_site(text) from public,anon,authenticated;
revoke all on function public.kino_analytics_summary_site(text,integer) from public,anon,authenticated;
grant execute on function public.kino_analytics_reset_site(text) to service_role;
grant execute on function public.kino_analytics_summary_site(text,integer) to service_role;

notify pgrst,'reload schema';
