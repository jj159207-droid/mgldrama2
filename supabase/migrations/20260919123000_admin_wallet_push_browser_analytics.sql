-- Reliability upgrade: sequential browser IDs, admin wallet credits,
-- web-push subscriptions and resettable richer analytics.
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- 1) Stable sequential browser/user number for admin identification.
create sequence if not exists public.browser_no_seq;
alter table public.users add column if not exists browser_no bigint;

with ranked as (
  select id,row_number() over(order by created_at nulls last,id)::bigint as rn
  from public.users
)
update public.users u
set browser_no=r.rn
from ranked r
where u.id=r.id and u.browser_no is null;

select setval(
  'public.browser_no_seq',
  greatest(coalesce((select max(browser_no) from public.users),0),1),
  coalesce((select max(browser_no) from public.users),0)>0
);

alter sequence public.browser_no_seq owned by public.users.browser_no;
alter table public.users alter column browser_no set default nextval('public.browser_no_seq');
alter table public.users alter column browser_no set not null;
create unique index if not exists kino_users_browser_no_unique on public.users(browser_no);
revoke all on sequence public.browser_no_seq from public,anon,authenticated;
grant usage,select on sequence public.browser_no_seq to service_role;

-- 2) Push subscriptions. Private VAPID key is inserted separately, never committed.
create table if not exists public.push_vapid_config (
  id smallint primary key check (id=1),
  public_key text not null,
  private_jwk jsonb not null,
  subject text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.push_vapid_config enable row level security;
revoke all on public.push_vapid_config from public,anon,authenticated;
grant select,insert,update on public.push_vapid_config to service_role;

create table if not exists public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id bigint not null references public.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text,
  auth text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists kino_push_user_idx on public.push_subscriptions(user_id,id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from public,anon,authenticated;
grant select,insert,update,delete on public.push_subscriptions to service_role;
revoke all on sequence public.push_subscriptions_id_seq from public,anon,authenticated;
grant usage,select on sequence public.push_subscriptions_id_seq to service_role;

-- 3) Admin wallet credit is a first-class audited ledger kind.
alter table public.wallet_ledger drop constraint if exists wallet_ledger_kind_check;
alter table public.wallet_ledger
  add constraint wallet_ledger_kind_check
  check (kind in ('topup','purchase','admin_credit'));

create or replace function public.kino_chat_wallet_credit(
  p_user bigint,
  p_amount integer,
  p_request uuid
)
returns table(payment_id bigint,amount integer,balance bigint,message_id bigint)
language plpgsql security invoker set search_path = '' as $$
declare
  owner public.users;
  saved public.pending_payments;
  bal bigint;
  receipt bigint;
begin
  if p_user is null or p_request is null or p_amount is null
     or p_amount < 1000 or p_amount > 500000 then
    raise exception 'Invalid admin wallet credit' using errcode='22023';
  end if;

  select * into owner from public.users where id=p_user for update;
  if not found then raise exception 'Unknown user' using errcode='P0404'; end if;

  select * into saved
  from public.pending_payments
  where ref_code='admin-wallet-'||p_request::text;

  if found then
    if saved.user_id<>p_user or saved.plan<>'wallet_admin' or saved.status<>'confirmed' then
      raise exception 'Admin wallet credit changed' using errcode='P0409';
    end if;
  else
    insert into public.pending_payments(ref_code,user_id,phone,film_id,plan,amount,status,confirmed_at)
    values('admin-wallet-'||p_request::text,p_user,owner.phone,null,'wallet_admin',0,'confirmed',clock_timestamp())
    returning * into saved;

    insert into public.wallet_ledger(user_id,delta,kind,payment_id,film_id)
    values(p_user,p_amount,'admin_credit',saved.id,null);
  end if;

  select coalesce(sum(w.delta),0)::bigint into bal
  from public.wallet_ledger w
  where w.user_id=p_user;

  select m.id into receipt
  from public.support_messages m
  where m.user_id=p_user and m.grant_payment_id=saved.id
  order by m.id desc limit 1;

  if receipt is null then
    select id into receipt
    from public.kino_chat_send(
      p_user,
      'admin',
      '💰 Админ таны кино дансанд '||to_char(p_amount,'FM999G999G999')||
      '₮ нэмлээ. Шинэ үлдэгдэл: '||to_char(bal,'FM999G999G999')||'₮.',
      null,
      p_request
    );
    update public.support_messages set grant_payment_id=saved.id where id=receipt;
  end if;

  return query select saved.id,p_amount,bal,receipt;
end $$;

revoke all on function public.kino_chat_wallet_credit(bigint,integer,uuid) from public,anon,authenticated;
grant execute on function public.kino_chat_wallet_credit(bigint,integer,uuid) to service_role;

-- 4) Chat grants: include Russian packages too.
create or replace function public.kino_chat_grant(p_user bigint,p_plan text,p_film bigint,p_request uuid)
returns table(payment_id bigint,plan text,film_id bigint,expires_at timestamptz)
language plpgsql security invoker set search_path = '' as $$
declare owner public.users; saved public.pending_payments; film_title text; label text; days integer; receipt bigint;
begin
 if p_user is null or p_request is null or p_plan is null or p_plan not in
  ('single','3day','all_1month',
   'erotic_3day','gadaad_3day','hyatad_3day','oros_3day',
   'erotic_1month','gadaad_1month','hyatad_1month','oros_1month')
 then raise exception 'Invalid grant' using errcode='22023'; end if;
 if (p_plan='single' and p_film is null) or (p_plan<>'single' and p_film is not null) then raise exception 'Invalid film' using errcode='22023'; end if;
 select * into owner from public.users where id=p_user for update;
 if not found then raise exception 'Unknown user' using errcode='P0404'; end if;
 days := case when p_plan in ('single','3day') or right(p_plan,5)='_3day' then 3 else 30 end;
 select * into saved from public.pending_payments where ref_code='chat-'||p_request::text;
 if found then
  if saved.user_id<>p_user or saved.plan<>p_plan or saved.film_id is distinct from p_film or saved.status<>'confirmed' then raise exception 'Grant changed' using errcode='P0409'; end if;
 else
  if p_plan='single' then
   select title into film_title from public.films where id=p_film;
   if not found then raise exception 'Unknown film' using errcode='P0404'; end if;
   label := '«'||left(coalesce(film_title,'Кино'),200)||'» кино · 3 хоног';
  else
   label := case split_part(p_plan,'_',1)
     when 'erotic' then 'Эротик'
     when 'gadaad' then 'Гадаад'
     when 'hyatad' then 'Хятад'
     when 'oros' then 'Орос'
     else 'Бүх кино' end || ' · ' || days || ' хоног';
  end if;
  insert into public.pending_payments(ref_code,user_id,phone,film_id,plan,amount,status,confirmed_at)
   values('chat-'||p_request::text,p_user,owner.phone,p_film,p_plan,0,'confirmed',clock_timestamp()) returning * into saved;
  select id into receipt from public.kino_chat_send(p_user,'admin',
   '✅ Таны '||label||' үзэх эрхийг админ нээлээ. Хүчинтэй хугацаа: '||
   to_char((saved.confirmed_at+make_interval(days=>days)) at time zone 'Asia/Ulaanbaatar','YYYY-MM-DD HH24:MI')||' (Улаанбаатар).',null,p_request);
  update public.support_messages set grant_payment_id=saved.id where id=receipt;
 end if;
 return query select saved.id,p_plan,p_film,saved.confirmed_at+make_interval(days=>days);
end $$;
revoke all on function public.kino_chat_grant(bigint,text,bigint,uuid) from public,anon,authenticated;
grant execute on function public.kino_chat_grant(bigint,text,bigint,uuid) to service_role;

-- 5) Inbox includes sequential browser number.
drop function if exists public.kino_chat_inbox(text,integer);
create function public.kino_chat_inbox(p_search text default '',p_offset integer default 0)
returns table(user_id bigint,phone text,label text,browser_no bigint,message text,has_image boolean,sender text,updated_at timestamptz,unread bigint)
language sql stable security invoker set search_path = '' as $$
 select t.user_id,u.phone,u.user_id,u.browser_no,m.message,m.has_image,m.sender,t.updated_at,
 (select count(*) from public.support_messages n where n.user_id=t.user_id and n.sender='user' and n.read_at is null)
 from public.support_threads t join public.users u on u.id=t.user_id
 join lateral (select s.message,s.has_image,s.sender from public.support_messages s where s.user_id=t.user_id order by s.id desc limit 1) m on true
 where p_search='' or position(p_search in u.phone)>0 or position(p_search in coalesce(u.user_id,''))>0
   or position(p_search in u.browser_no::text)>0
 order by t.updated_at desc,t.user_id desc limit 51 offset greatest(0,least(p_offset,1000000));
$$;
revoke all on function public.kino_chat_inbox(text,integer) from public,anon,authenticated;
grant execute on function public.kino_chat_inbox(text,integer) to service_role;

-- 6) Resettable, richer analytics. Reset is non-destructive: old raw events remain.
create table if not exists public.analytics_state (
  id smallint primary key check(id=1),
  reset_at timestamptz not null default '1970-01-01 00:00:00+00',
  updated_at timestamptz not null default now()
);
insert into public.analytics_state(id,reset_at) values(1,'1970-01-01 00:00:00+00')
on conflict(id) do nothing;
alter table public.analytics_state enable row level security;
revoke all on public.analytics_state from public,anon,authenticated;
grant select,insert,update on public.analytics_state to service_role;

create or replace function public.kino_analytics_reset()
returns table(reset_at timestamptz)
language plpgsql security invoker set search_path = '' as $$
declare stamp timestamptz:=clock_timestamp();
begin
  update public.analytics_state set reset_at=stamp,updated_at=stamp where id=1;
  return query select stamp;
end $$;
revoke all on function public.kino_analytics_reset() from public,anon,authenticated;
grant execute on function public.kino_analytics_reset() to service_role;

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
    (select count(distinct e.visitor_key) from public.site_events e
      where e.event_type='visit'
        and e.created_at >= (x.day_date::timestamp at time zone 'Asia/Ulaanbaatar')
        and e.created_at < ((x.day_date+1)::timestamp at time zone 'Asia/Ulaanbaatar'))::bigint visitors,
    (select count(*) from public.site_events e
      where e.event_type='watch_click'
        and e.created_at >= (x.day_date::timestamp at time zone 'Asia/Ulaanbaatar')
        and e.created_at < ((x.day_date+1)::timestamp at time zone 'Asia/Ulaanbaatar'))::bigint watch_clicks,
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
    'newBrowsers',(select count(*) from public.users u,bounds b where u.created_at>=b.period_start),
    'totalBrowsersSinceReset',(select count(*) from public.users u,bounds b where u.created_at>=b.reset_at),
    'filmOpens',(select count(*) from period_events where event_type='film_open'),
    'watchClicks',(select count(*) from period_events where event_type='watch_click'),
    'playStarts',(select count(*) from period_events where event_type='play_start'),
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
    'watchToPlayPct',(select case when count(*) filter(where event_type='watch_click')=0 then 0 else round(100.0*count(*) filter(where event_type='play_start')/count(*) filter(where event_type='watch_click'),1) end from period_events)
  ),
  'topFilms',coalesce((select jsonb_agg(to_jsonb(t)) from top_films t),'[]'::jsonb),
  'daily',coalesce((select jsonb_agg(to_jsonb(d) order by d.day_date) from daily d),'[]'::jsonb)
);
$$;
revoke all on function public.kino_analytics_summary(integer) from public,anon,authenticated;
grant execute on function public.kino_analytics_summary(integer) to service_role;

notify pgrst,'reload schema';
