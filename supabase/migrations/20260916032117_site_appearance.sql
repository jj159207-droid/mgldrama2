-- One public theme, written only through the server's authenticated admin route.
-- Kept separate from Messenger settings and SMS/payment records.
create table if not exists public.site_appearance (
  id integer primary key default 1 check (id = 1),
  layout integer not null default 1 check (layout between 1 and 4),
  tone integer not null default 25 check (tone between 0 and 100),
  revision integer not null default 0 check (revision >= 0)
);
alter table public.site_appearance enable row level security;
revoke all on public.site_appearance from public, anon, authenticated, service_role;
grant select on public.site_appearance to service_role;
grant update (layout,tone,revision) on public.site_appearance to service_role;
drop policy if exists site_appearance_server on public.site_appearance;
create policy site_appearance_server on public.site_appearance to service_role using (true) with check (true);
insert into public.site_appearance(id,layout,tone,revision) values (1,1,25,0) on conflict (id) do nothing;
comment on table public.site_appearance is 'Singleton site appearance. The Next.js API authenticates admin writes and validates layout/tone. Browser roles have no direct access.';
notify pgrst, 'reload schema';
