-- Add only fields needed by the reviewed app. Does not revoke legacy app access.
-- Run separately from setup.sql on an existing project.
begin;
-- Packages have no individual film. Existing film IDs remain unchanged.
alter table public.pending_payments alter column film_id drop not null;
alter table public.sms_logs add column if not exists key text;
alter table public.sms_logs add column if not exists value text;
alter table public.sms_logs add column if not exists text text;
alter table public.films add column if not exists preview_url text default '';
alter table public.pending_payments add column if not exists confirmed_at timestamptz;
alter table public.pending_payments add column if not exists phone text;
create index if not exists kino_payments_owner_status on public.pending_payments(user_id,status);
create index if not exists kino_sessions_expiry on public.app_sessions(expires_at);
notify pgrst, 'reload schema';
commit;
