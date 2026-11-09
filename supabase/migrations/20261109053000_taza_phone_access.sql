-- Manual phone-based TAZA entitlements. The phone itself is NOT proof of ownership.
-- Admin grants are separate from existing paid receipts; no existing rights are removed.
create table if not exists public.taza_phone_grants (
  id bigint generated always as identity primary key,
  site_id text not null default 'taza' check (site_id = 'taza'),
  phone text not null check (phone ~ '^[0-9]{8}$'),
  access_type text not null check (access_type in ('single','all')),
  film_id bigint null references public.films(id) on delete restrict,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint taza_phone_grants_single_film check (access_type = 'single' or film_id is null),
  constraint taza_phone_grants_unique_phone unique (site_id,phone)
);
create table if not exists public.taza_phone_sessions (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  grant_id bigint not null references public.taza_phone_grants(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists taza_phone_sessions_grant_idx on public.taza_phone_sessions(grant_id);
create index if not exists taza_phone_sessions_expiry_idx on public.taza_phone_sessions(expires_at);
alter table public.taza_phone_grants enable row level security;
alter table public.taza_phone_sessions enable row level security;
revoke all on table public.taza_phone_grants from anon,authenticated,public;
revoke all on table public.taza_phone_sessions from anon,authenticated,public;
revoke all on sequence public.taza_phone_grants_id_seq from anon,authenticated,public;
grant select,insert,update,delete on public.taza_phone_grants to service_role;
grant select,insert,update,delete on public.taza_phone_sessions to service_role;
grant usage,select on sequence public.taza_phone_grants_id_seq to service_role;
comment on table public.taza_phone_grants is 'Admin-issued phone grants; phone-only redemption is not proof of ownership. Only server-side service role may access.';
comment on table public.taza_phone_sessions is 'Hashed opaque browser cookies issued upon phone grant redemption. Revocable by deleting rows or deactivating the grant.';
