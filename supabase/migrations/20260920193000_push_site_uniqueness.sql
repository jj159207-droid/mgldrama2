alter table public.push_subscriptions
  drop constraint if exists push_subscriptions_endpoint_key;

create unique index if not exists push_subscriptions_site_endpoint_unique
  on public.push_subscriptions(site_id,endpoint);

notify pgrst,'reload schema';
