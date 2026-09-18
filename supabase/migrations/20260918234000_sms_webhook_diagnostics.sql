create table if not exists public.sms_webhook_events (
  id bigint generated always as identity primary key,
  sender text,
  ref_code text,
  amount integer,
  outcome text not null,
  detail text,
  message_hash text,
  created_at timestamptz not null default now()
);

create index if not exists sms_webhook_events_created_idx
  on public.sms_webhook_events(created_at desc);
create index if not exists sms_webhook_events_ref_idx
  on public.sms_webhook_events(ref_code,created_at desc);

alter table public.sms_webhook_events enable row level security;
revoke all on public.sms_webhook_events from public,anon,authenticated;
grant select,insert on public.sms_webhook_events to service_role;
revoke all on sequence public.sms_webhook_events_id_seq from public,anon,authenticated;
grant usage,select on sequence public.sms_webhook_events_id_seq to service_role;

notify pgrst,'reload schema';
