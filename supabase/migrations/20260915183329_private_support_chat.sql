-- Custom HttpOnly app sessions are verified by /api/chat. These tables and
-- invoker RPCs are accessible only to the server's service_role, never public keys.
set local lock_timeout = '5s';
set local statement_timeout = '30s';
alter table public.contact_messages add column if not exists user_id bigint;

create table public.support_threads (
 user_id bigint primary key references public.users(id) on delete cascade,
 updated_at timestamptz not null default now(),
 rate_start timestamptz not null default now(),
 rate_count integer not null default 0
);
create index support_threads_recent on public.support_threads(updated_at desc, user_id desc);
create table public.support_messages (
 id bigint generated always as identity primary key,
 user_id bigint not null references public.support_threads(user_id) on delete cascade,
 sender text not null check (sender in ('user','admin')),
 message text not null default '' check (length(message) <= 2000),
 has_image boolean not null default false,
 client_id uuid not null,
 created_at timestamptz not null default now(),
 read_at timestamptz,
 unique(user_id,sender,client_id),
 check (length(btrim(message)) > 0 or has_image)
);
create index support_messages_thread on public.support_messages(user_id,id desc);
create index support_messages_unread on public.support_messages(sender,user_id,id) where read_at is null;
-- Small, optimized images are private and transactionally coupled to retention.
-- No public URL, unclaimed upload, expired signed URL, or storage cleanup race.
create table public.support_images (
 message_id bigint primary key references public.support_messages(id) on delete cascade,
 data bytea not null check (octet_length(data) between 1 and 350000)
);
alter table public.support_threads enable row level security;
alter table public.support_messages enable row level security;
alter table public.support_images enable row level security;
revoke all on public.support_threads,public.support_messages,public.support_images from public,anon,authenticated;
grant all on public.support_threads,public.support_messages,public.support_images to service_role;
revoke all on sequence public.support_messages_id_seq from public,anon,authenticated;
grant usage,select on sequence public.support_messages_id_seq to service_role;

create function public.kino_chat_send(p_user bigint,p_sender text,p_message text,p_image text,p_client uuid)
returns table(id bigint,user_id bigint,sender text,message text,has_image boolean,client_id uuid,created_at timestamptz,read_at timestamptz)
language plpgsql security invoker set search_path = '' as $$
declare t public.support_threads; saved public.support_messages; image_bytes bytea;
begin
 if p_user is null or p_sender is null or p_sender not in ('admin','user') or p_client is null
    or p_message is null or length(p_message)>2000 or (length(btrim(p_message))=0 and p_image is null)
 then raise exception 'Invalid message' using errcode='22023'; end if;
 if p_image is not null then
   if length(p_image)>466668 then raise exception 'Image too large' using errcode='22023'; end if;
   image_bytes := decode(p_image,'base64');
   if octet_length(image_bytes) not between 1 and 350000 then raise exception 'Invalid image' using errcode='22023'; end if;
 end if;
 insert into public.support_threads(user_id) values(p_user) on conflict do nothing;
 -- Serialize writers before assigning IDs and trimming. Concurrent sends cannot
 -- exceed 100 messages or delete messages belonging to another conversation.
 select * into t from public.support_threads s where s.user_id=p_user for update;
 select * into saved from public.support_messages m where m.user_id=p_user and m.sender=p_sender and m.client_id=p_client;
 if found then
   return query select m.id,m.user_id,m.sender,m.message,m.has_image,m.client_id,m.created_at,m.read_at from public.support_messages m where m.id=saved.id;
   return;
 end if;
 if t.rate_start > now()-interval '1 minute' and t.rate_count >= 60 then
   raise exception 'Message rate exceeded' using errcode='P0429';
 end if;
 update public.support_threads s set updated_at=clock_timestamp(),
   rate_count=case when t.rate_start <= now()-interval '1 minute' then 1 else t.rate_count+1 end,
   rate_start=case when t.rate_start <= now()-interval '1 minute' then now() else t.rate_start end
 where s.user_id=p_user;
 insert into public.support_messages(user_id,sender,message,has_image,client_id)
 values(p_user,p_sender,btrim(p_message),p_image is not null,p_client) returning * into saved;
 if image_bytes is not null then insert into public.support_images(message_id,data) values(saved.id,image_bytes); end if;
 delete from public.support_messages m where m.user_id=p_user and m.id in
   (select old.id from public.support_messages old where old.user_id=p_user order by old.id desc offset 100);
 return query select m.id,m.user_id,m.sender,m.message,m.has_image,m.client_id,m.created_at,m.read_at from public.support_messages m where m.id=saved.id;
end $$;

create function public.kino_chat_inbox(p_search text default '',p_offset integer default 0)
returns table(user_id bigint,phone text,label text,message text,has_image boolean,sender text,updated_at timestamptz,unread bigint)
language sql stable security invoker set search_path = '' as $$
 select t.user_id,u.phone,u.user_id,m.message,m.has_image,m.sender,t.updated_at,
 (select count(*) from public.support_messages n where n.user_id=t.user_id and n.sender='user' and n.read_at is null)
 from public.support_threads t join public.users u on u.id=t.user_id
 join lateral (select s.message,s.has_image,s.sender from public.support_messages s where s.user_id=t.user_id order by s.id desc limit 1) m on true
 where p_search='' or position(p_search in u.phone)>0 or position(p_search in coalesce(u.user_id,''))>0
 order by t.updated_at desc,t.user_id desc limit 51 offset greatest(0,least(p_offset,1000000));
$$;

create function public.kino_chat_unread(p_user bigint,p_admin boolean)
returns table(unread bigint) language sql stable security invoker set search_path = '' as $$
 select count(*) from public.support_messages m where m.read_at is null
 and m.sender=case when p_admin then 'user' else 'admin' end and (p_admin or m.user_id=p_user);
$$;
revoke all on function public.kino_chat_send(bigint,text,text,text,uuid),public.kino_chat_inbox(text,integer),public.kino_chat_unread(bigint,boolean) from public,anon,authenticated;
grant execute on function public.kino_chat_send(bigint,text,text,text,uuid),public.kino_chat_inbox(text,integer),public.kino_chat_unread(bigint,boolean) to service_role;

-- Preserve the latest 100 legacy messages/replies with an explicit valid owner.
-- Original requests and announcements remain untouched for audit/recovery.
insert into public.support_threads(user_id,updated_at)
 select u.id,coalesce(max(c.created_at),now()) from public.contact_messages c join public.users u on u.id=c.user_id
 where c.is_announcement is not true and (length(btrim(coalesce(c.message,'')))>0 or length(btrim(coalesce(c.reply,'')))>0)
 group by u.id on conflict do nothing;
with legacy as (
 select c.user_id,c.id legacy_id,'user'::text sender,left(c.message,2000) message,
   md5('legacy-user-'||c.id)::uuid client_id,coalesce(c.created_at,now()) created_at,
   case when c.read then coalesce(c.created_at,now()) end read_at,0 part
 from public.contact_messages c join public.users u on u.id=c.user_id
 where c.is_announcement is not true and length(btrim(coalesce(c.message,'')))>0
 union all
 select c.user_id,c.id,'admin',left(c.reply,2000),md5('legacy-admin-'||c.id)::uuid,
   coalesce(c.created_at,now()),case when (to_jsonb(c)->>'user_read')::boolean then coalesce(c.created_at,now()) end,1
 from public.contact_messages c join public.users u on u.id=c.user_id
 where c.is_announcement is not true and length(btrim(coalesce(c.reply,'')))>0
), ranked as (
 select *,row_number() over(partition by user_id order by created_at desc,legacy_id desc,part desc) rn from legacy
)
insert into public.support_messages(user_id,sender,message,client_id,created_at,read_at)
 select user_id,sender,message,client_id,created_at,read_at from ranked where rn<=100 order by created_at,legacy_id,part;
notify pgrst,'reload schema';
