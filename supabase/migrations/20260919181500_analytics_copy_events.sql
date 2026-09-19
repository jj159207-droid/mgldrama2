set local lock_timeout='5s';
set local statement_timeout='30s';

alter table public.site_events
  drop constraint if exists site_events_event_type_check;

alter table public.site_events
  add constraint site_events_event_type_check
  check (event_type = any (array[
    'visit'::text,
    'film_open'::text,
    'watch_click'::text,
    'payment_open'::text,
    'play_start'::text,
    'bank_account_copy'::text,
    'ref_code_copy'::text
  ]));

create or replace function public.kino_analytics_copy_summary(p_days integer default 30)
returns table(summary jsonb)
language sql
stable
set search_path=''
as $$
with cfg as (
  select coalesce(
    (select s.reset_at from public.analytics_state s where s.id=1),
    '1970-01-01 00:00:00+00'::timestamptz
  ) reset_at
),
bounds as (
  select
    greatest(1,least(coalesce(p_days,30),365))::int as days,
    c.reset_at,
    greatest(c.reset_at,now()-make_interval(days=>greatest(1,least(coalesce(p_days,30),365)))) as period_start,
    greatest(c.reset_at,date_trunc('day',now() at time zone 'Asia/Ulaanbaatar') at time zone 'Asia/Ulaanbaatar') as today_start
  from cfg c
)
select jsonb_build_object(
  'today',jsonb_build_object(
    'bankAccountCopies',(select count(*) from public.site_events e,bounds b where e.event_type='bank_account_copy' and e.created_at>=b.today_start),
    'uniqueBankCopyVisitors',(select count(distinct e.visitor_key) from public.site_events e,bounds b where e.event_type='bank_account_copy' and e.created_at>=b.today_start),
    'refCodeCopies',(select count(*) from public.site_events e,bounds b where e.event_type='ref_code_copy' and e.created_at>=b.today_start),
    'uniqueRefCopyVisitors',(select count(distinct e.visitor_key) from public.site_events e,bounds b where e.event_type='ref_code_copy' and e.created_at>=b.today_start)
  ),
  'period',jsonb_build_object(
    'bankAccountCopies',(select count(*) from public.site_events e,bounds b where e.event_type='bank_account_copy' and e.created_at>=b.period_start),
    'uniqueBankCopyVisitors',(select count(distinct e.visitor_key) from public.site_events e,bounds b where e.event_type='bank_account_copy' and e.created_at>=b.period_start),
    'refCodeCopies',(select count(*) from public.site_events e,bounds b where e.event_type='ref_code_copy' and e.created_at>=b.period_start),
    'uniqueRefCopyVisitors',(select count(distinct e.visitor_key) from public.site_events e,bounds b where e.event_type='ref_code_copy' and e.created_at>=b.period_start)
  )
);
$$;

revoke all on function public.kino_analytics_copy_summary(integer) from public,anon,authenticated;
grant execute on function public.kino_analytics_copy_summary(integer) to service_role;

notify pgrst,'reload schema';
