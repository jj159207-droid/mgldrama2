set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.users add column if not exists is_guest boolean not null default false;
create index if not exists kino_users_guest_created on public.users(created_at) where is_guest;

-- Keep the existing inbox contract, but give anonymous devices a safe, readable label.
create or replace function public.kino_chat_inbox(p_search text default '',p_offset integer default 0)
returns table(user_id bigint,phone text,label text,message text,has_image boolean,sender text,updated_at timestamptz,unread bigint)
language sql stable security invoker set search_path = '' as $$
 select t.user_id,
   case when u.is_guest then 'Төхөөрөмж '||coalesce(u.user_id,'#'||u.id::text) else u.phone end,
   u.user_id,m.message,m.has_image,m.sender,t.updated_at,
   (select count(*) from public.support_messages n where n.user_id=t.user_id and n.sender='user' and n.read_at is null)
 from public.support_threads t join public.users u on u.id=t.user_id
 join lateral (select s.message,s.has_image,s.sender from public.support_messages s where s.user_id=t.user_id order by s.id desc limit 1) m on true
 where p_search='' or position(lower(p_search) in lower(coalesce(u.phone,'')))>0 or position(lower(p_search) in lower(coalesce(u.user_id,'')))>0
 order by t.updated_at desc,t.user_id desc limit 51 offset greatest(0,least(p_offset,1000000));
$$;
revoke all on function public.kino_chat_inbox(text,integer) from public,anon,authenticated;
grant execute on function public.kino_chat_inbox(text,integer) to service_role;
notify pgrst,'reload schema';
