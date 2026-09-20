insert into public.site_user_memberships(site_id,user_id,first_seen_at,last_seen_at)
select 'taza',u.id,coalesce(u.created_at,now()),now()
from public.users u
on conflict(site_id,user_id) do nothing;

notify pgrst,'reload schema';
