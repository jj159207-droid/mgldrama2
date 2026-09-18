-- First-party site analytics: visits, movie opens, watch clicks and playback starts.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table if not exists public.site_events (
  id bigint generated always as identity primary key,
  visitor_key text not null check (visitor_key ~ '^[a-f0-9]{32}$'),
  event_type text not null check (event_type in ('visit','film_open','watch_click','play_start')),
  film_id bigint references public.films(id) on delete set null,
  source text not null default 'direct' check (source in ('facebook','direct','other')),
  created_at timestamptz not null default now()
);

create index if not exists site_events_created_idx
  on public.site_events(created_at desc);
create index if not exists site_events_type_created_idx
  on public.site_events(event_type,created_at desc);
create index if not exists site_events_film_type_created_idx
  on public.site_events(film_id,event_type,created_at desc);
create index if not exists site_events_visitor_created_idx
  on public.site_events(visitor_key,created_at desc);

alter table public.site_events enable row level security;
revoke all on public.site_events from public,anon,authenticated;
grant select,insert on public.site_events to service_role;
revoke all on sequence public.site_events_id_seq from public,anon,authenticated;
grant usage,select on sequence public.site_events_id_seq to service_role;

create or replace function public.kino_analytics_summary(p_days integer default 30)
returns table(summary jsonb)
language sql stable security invoker set search_path = '' as $$
  with bounds as (
    select
      greatest(1,least(coalesce(p_days,30),365))::int as days,
      (timezone('Asia/Ulaanbaatar',now())::date at time zone 'Asia/Ulaanbaatar') as today_start
  ),
  period_events as (
    select e.*
    from public.site_events e,bounds b
    where e.created_at >= now() - make_interval(days=>b.days)
  ),
  top_films as (
    select
      e.film_id,
      coalesce(f.title,'#'||e.film_id::text) as title,
      count(*) filter(where e.event_type='film_open')::bigint as opens,
      count(*) filter(where e.event_type='watch_click')::bigint as watch_clicks,
      count(*) filter(where e.event_type='play_start')::bigint as play_starts
    from period_events e
    left join public.films f on f.id=e.film_id
    where e.film_id is not null
    group by e.film_id,f.title
    having count(*) filter(where e.event_type in ('film_open','watch_click','play_start'))>0
    order by watch_clicks desc,play_starts desc,opens desc,e.film_id desc
    limit 20
  )
  select jsonb_build_object(
    'days',(select days from bounds),
    'today',jsonb_build_object(
      'visits',(select count(*) from public.site_events e,bounds b where e.event_type='visit' and e.created_at>=b.today_start),
      'uniqueVisitors',(select count(distinct e.visitor_key) from public.site_events e,bounds b where e.event_type='visit' and e.created_at>=b.today_start),
      'filmOpens',(select count(*) from public.site_events e,bounds b where e.event_type='film_open' and e.created_at>=b.today_start),
      'watchClicks',(select count(*) from public.site_events e,bounds b where e.event_type='watch_click' and e.created_at>=b.today_start),
      'playStarts',(select count(*) from public.site_events e,bounds b where e.event_type='play_start' and e.created_at>=b.today_start),
      'facebookVisits',(select count(*) from public.site_events e,bounds b where e.event_type='visit' and e.source='facebook' and e.created_at>=b.today_start)
    ),
    'period',jsonb_build_object(
      'visits',(select count(*) from period_events where event_type='visit'),
      'uniqueVisitors',(select count(distinct visitor_key) from period_events where event_type='visit'),
      'filmOpens',(select count(*) from period_events where event_type='film_open'),
      'watchClicks',(select count(*) from period_events where event_type='watch_click'),
      'playStarts',(select count(*) from period_events where event_type='play_start'),
      'facebookVisits',(select count(*) from period_events where event_type='visit' and source='facebook')
    ),
    'topFilms',coalesce((select jsonb_agg(to_jsonb(t)) from top_films t),'[]'::jsonb)
  );
$$;

revoke all on function public.kino_analytics_summary(integer) from public,anon,authenticated;
grant execute on function public.kino_analytics_summary(integer) to service_role;

notify pgrst,'reload schema';
