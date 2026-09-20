alter table public.support_threads
  add column if not exists site_id text not null default 'taza';
alter table public.support_messages
  add column if not exists site_id text not null default 'taza';

alter table public.support_messages drop constraint if exists support_messages_user_id_fkey;
alter table public.support_messages drop constraint if exists support_messages_user_id_sender_client_id_key;
alter table public.support_threads drop constraint if exists support_threads_pkey;

alter table public.support_threads
  add constraint support_threads_pkey primary key(site_id,user_id);
alter table public.support_threads
  add constraint support_threads_site_id_fkey foreign key(site_id) references public.sites(id);
alter table public.support_messages
  add constraint support_messages_thread_fkey foreign key(site_id,user_id)
  references public.support_threads(site_id,user_id) on delete cascade;
alter table public.support_messages
  add constraint support_messages_site_user_sender_client_key unique(site_id,user_id,sender,client_id);

create index if not exists support_messages_site_user_id_idx
on public.support_messages(site_id,user_id,id desc);
create index if not exists support_threads_site_updated_idx
on public.support_threads(site_id,updated_at desc);

create or replace function public.kino_chat_activity_site(
  p_site text,p_user bigint,p_admin boolean,p_active boolean,p_typing boolean
)
returns table(ok boolean)
language plpgsql
set search_path=''
as $$
begin
 if p_site not in ('taza','kino-drama','kinochid','fire') or p_user is null or p_admin is null or p_active is null or p_typing is null
 then raise exception 'Invalid activity' using errcode='22023'; end if;
 insert into public.support_threads(site_id,user_id) values(p_site,p_user) on conflict do nothing;
 if p_admin then
  update public.support_threads set admin_seen_at=case when p_active then clock_timestamp() end,
   admin_typing_at=case when p_active and p_typing then clock_timestamp() end
   where site_id=p_site and user_id=p_user;
 else
  update public.support_threads set user_seen_at=case when p_active then clock_timestamp() end,
   user_typing_at=case when p_active and p_typing then clock_timestamp() end
   where site_id=p_site and user_id=p_user;
 end if;
 return query select true;
end $$;

create or replace function public.kino_chat_clear_site(p_site text,p_user bigint,p_through bigint)
returns table(deleted bigint)
language plpgsql
set search_path=''
as $$
declare n bigint;
begin
 if p_site not in ('taza','kino-drama','kinochid','fire') or p_user is null or p_through is null or p_through<1
 then raise exception 'Invalid clear' using errcode='22023'; end if;
 perform 1 from public.support_threads where site_id=p_site and user_id=p_user for update;
 delete from public.support_messages where site_id=p_site and user_id=p_user and id<=p_through;
 get diagnostics n=row_count;
 return query select n;
end $$;

create or replace function public.kino_chat_inbox_site(p_site text,p_search text default '',p_offset integer default 0)
returns table(user_id bigint,phone text,label text,browser_no bigint,message text,has_image boolean,sender text,updated_at timestamptz,unread bigint)
language sql
stable
set search_path=''
as $$
 select t.user_id,u.phone,u.user_id,u.browser_no,m.message,m.has_image,m.sender,t.updated_at,
 (select count(*) from public.support_messages n where n.site_id=p_site and n.user_id=t.user_id and n.sender='user' and n.read_at is null)
 from public.support_threads t join public.users u on u.id=t.user_id
 join lateral (
   select s.message,s.has_image,s.sender from public.support_messages s
   where s.site_id=p_site and s.user_id=t.user_id order by s.id desc limit 1
 ) m on true
 where t.site_id=p_site and (
   p_search='' or position(p_search in u.phone)>0 or position(p_search in coalesce(u.user_id,''))>0
   or position(p_search in u.browser_no::text)>0
 )
 order by t.updated_at desc,t.user_id desc limit 51 offset greatest(0,least(p_offset,1000000));
$$;

create or replace function public.kino_chat_send_site(
  p_site text,p_user bigint,p_sender text,p_message text,p_image text,p_client uuid
)
returns table(id bigint,user_id bigint,sender text,message text,has_image boolean,client_id uuid,created_at timestamptz,read_at timestamptz)
language plpgsql
set search_path=''
as $$
declare t public.support_threads; saved public.support_messages; image_bytes bytea;
begin
 if p_site not in ('taza','kino-drama','kinochid','fire') or p_user is null or p_sender is null
    or p_sender not in ('admin','user') or p_client is null or p_message is null or length(p_message)>2000
    or (length(btrim(p_message))=0 and p_image is null)
 then raise exception 'Invalid message' using errcode='22023'; end if;
 if p_image is not null then
   if length(p_image)>466668 then raise exception 'Image too large' using errcode='22023'; end if;
   image_bytes:=decode(p_image,'base64');
   if octet_length(image_bytes) not between 1 and 350000 then raise exception 'Invalid image' using errcode='22023'; end if;
 end if;
 insert into public.support_threads(site_id,user_id) values(p_site,p_user) on conflict do nothing;
 select * into t from public.support_threads s where s.site_id=p_site and s.user_id=p_user for update;
 select * into saved from public.support_messages m
   where m.site_id=p_site and m.user_id=p_user and m.sender=p_sender and m.client_id=p_client;
 if found then
   return query select m.id,m.user_id,m.sender,m.message,m.has_image,m.client_id,m.created_at,m.read_at
   from public.support_messages m where m.id=saved.id; return;
 end if;
 if t.rate_start>now()-interval '1 minute' and t.rate_count>=60 then
   raise exception 'Message rate exceeded' using errcode='P0429';
 end if;
 update public.support_threads s set updated_at=clock_timestamp(),
   rate_count=case when t.rate_start<=now()-interval '1 minute' then 1 else t.rate_count+1 end,
   rate_start=case when t.rate_start<=now()-interval '1 minute' then now() else t.rate_start end
 where s.site_id=p_site and s.user_id=p_user;
 insert into public.support_messages(site_id,user_id,sender,message,has_image,client_id)
 values(p_site,p_user,p_sender,btrim(p_message),p_image is not null,p_client) returning * into saved;
 if image_bytes is not null then insert into public.support_images(message_id,data) values(saved.id,image_bytes); end if;
 delete from public.support_messages m where m.site_id=p_site and m.user_id=p_user and m.id in
   (select old.id from public.support_messages old where old.site_id=p_site and old.user_id=p_user order by old.id desc offset 100);
 return query select m.id,m.user_id,m.sender,m.message,m.has_image,m.client_id,m.created_at,m.read_at
 from public.support_messages m where m.id=saved.id;
end $$;

create or replace function public.kino_chat_unread_site(p_site text,p_user bigint,p_admin boolean)
returns table(unread bigint)
language sql
stable
set search_path=''
as $$
 select count(*) from public.support_messages m
 where m.site_id=p_site and m.read_at is null
 and m.sender=case when p_admin then 'user' else 'admin' end
 and (p_admin or m.user_id=p_user);
$$;

create or replace function public.kino_chat_view_site(p_site text,p_user bigint,p_admin boolean)
returns table(messages jsonb,peer_online boolean,peer_typing boolean)
language sql
stable
set search_path=''
as $$
 select coalesce((select jsonb_agg(to_jsonb(m) order by m.id) from
  (select id,sender,message,has_image,client_id,created_at,read_at,grant_payment_id
   from public.support_messages where site_id=p_site and user_id=p_user order by id desc limit 100) m),'[]'::jsonb),
 coalesce((select (case when p_admin then user_seen_at else admin_seen_at end)>now()-interval '35 seconds'
   from public.support_threads where site_id=p_site and user_id=p_user),false),
 coalesce((select (case when p_admin then user_typing_at else admin_typing_at end)>now()-interval '6 seconds'
   from public.support_threads where site_id=p_site and user_id=p_user),false);
$$;

create or replace function public.kino_chat_grant_site(
  p_site text,p_user bigint,p_plan text,p_film bigint,p_request uuid
)
returns table(payment_id bigint,plan text,film_id bigint,expires_at timestamptz)
language plpgsql
set search_path=''
as $$
declare owner public.users; saved public.pending_payments; film_title text; label text; days integer; receipt bigint;
begin
 if p_site not in ('taza','kino-drama','kinochid','fire') or p_user is null or p_request is null or p_plan is null or p_plan not in
  ('single','3day','all_1month','erotic_3day','gadaad_3day','hyatad_3day','oros_3day',
   'erotic_1month','gadaad_1month','hyatad_1month','oros_1month')
 then raise exception 'Invalid grant' using errcode='22023'; end if;
 if (p_plan='single' and p_film is null) or (p_plan<>'single' and p_film is not null)
 then raise exception 'Invalid film' using errcode='22023'; end if;
 select * into owner from public.users where id=p_user for update;
 if not found then raise exception 'Unknown user' using errcode='P0404'; end if;
 if not exists(select 1 from public.site_user_memberships where site_id=p_site and user_id=p_user)
 then raise exception 'User not in site' using errcode='P0404'; end if;
 days:=case when p_plan in ('single','3day') or right(p_plan,5)='_3day' then 3 else 30 end;
 select * into saved from public.pending_payments where ref_code='chat-'||p_request::text;
 if found then
  if saved.site_id<>p_site or saved.user_id<>p_user or saved.plan<>p_plan or saved.film_id is distinct from p_film or saved.status<>'confirmed'
  then raise exception 'Grant changed' using errcode='P0409'; end if;
 else
  if p_plan='single' then
   select title into film_title from public.films where id=p_film and site_id=p_site;
   if not found then raise exception 'Unknown film' using errcode='P0404'; end if;
   label:='«'||left(coalesce(film_title,'Кино'),200)||'» кино · 3 хоног';
  else
   label:=case split_part(p_plan,'_',1)
     when 'erotic' then 'Эротик' when 'gadaad' then 'Гадаад' when 'hyatad' then 'Хятад'
     when 'oros' then 'Орос' else 'Бүх кино' end || ' · ' || days || ' хоног';
  end if;
  insert into public.pending_payments(ref_code,user_id,phone,film_id,plan,amount,status,confirmed_at,site_id)
   values('chat-'||p_request::text,p_user,owner.phone,p_film,p_plan,0,'confirmed',clock_timestamp(),p_site)
   returning * into saved;
  select id into receipt from public.kino_chat_send_site(
    p_site,p_user,'admin',
    '✅ Таны '||label||' үзэх эрхийг админ нээлээ. Хүчинтэй хугацаа: '||
    to_char((saved.confirmed_at+make_interval(days=>days)) at time zone 'Asia/Ulaanbaatar','YYYY-MM-DD HH24:MI')||' (Улаанбаатар).',
    null,p_request
  );
  update public.support_messages set grant_payment_id=saved.id where id=receipt;
 end if;
 return query select saved.id,p_plan,p_film,saved.confirmed_at+make_interval(days=>days);
end $$;

create or replace function public.kino_chat_wallet_credit_site(
  p_site text,p_user bigint,p_amount integer,p_request uuid
)
returns table(payment_id bigint,amount integer,balance bigint,message_id bigint)
language plpgsql
set search_path=''
as $$
declare owner public.users; saved public.pending_payments; bal bigint; receipt bigint;
begin
 if p_site not in ('taza','kino-drama','kinochid','fire') or p_user is null or p_request is null
    or p_amount is null or p_amount<1000 or p_amount>500000
 then raise exception 'Invalid admin wallet credit' using errcode='22023'; end if;
 select * into owner from public.users where id=p_user for update;
 if not found then raise exception 'Unknown user' using errcode='P0404'; end if;
 if not exists(select 1 from public.site_user_memberships where site_id=p_site and user_id=p_user)
 then raise exception 'User not in site' using errcode='P0404'; end if;

 select * into saved from public.pending_payments where ref_code='admin-wallet-'||p_request::text;
 if found then
  if saved.site_id<>p_site or saved.user_id<>p_user or saved.plan<>'wallet_admin' or saved.status<>'confirmed'
  then raise exception 'Admin wallet credit changed' using errcode='P0409'; end if;
 else
  insert into public.pending_payments(ref_code,user_id,phone,film_id,plan,amount,status,confirmed_at,site_id)
  values('admin-wallet-'||p_request::text,p_user,owner.phone,null,'wallet_admin',0,'confirmed',clock_timestamp(),p_site)
  returning * into saved;
  insert into public.wallet_ledger(user_id,delta,kind,payment_id,film_id,site_id)
  values(p_user,p_amount,'admin_credit',saved.id,null,p_site);
 end if;

 select coalesce(sum(w.delta),0)::bigint into bal
 from public.wallet_ledger w where w.user_id=p_user and w.site_id=p_site;

 select m.id into receipt from public.support_messages m
 where m.site_id=p_site and m.user_id=p_user and m.grant_payment_id=saved.id order by m.id desc limit 1;
 if receipt is null then
  select id into receipt from public.kino_chat_send_site(
    p_site,p_user,'admin',
    '💰 Админ таны кино дансанд '||to_char(p_amount,'FM999G999G999')||
    '₮ нэмлээ. Шинэ үлдэгдэл: '||to_char(bal,'FM999G999G999')||'₮.',
    null,p_request
  );
  update public.support_messages set grant_payment_id=saved.id where id=receipt;
 end if;
 return query select saved.id,p_amount,bal,receipt;
end $$;

-- Legacy wrappers remain strictly TAZA-only until main is switched to the new API.
create or replace function public.kino_chat_activity(p_user bigint,p_admin boolean,p_active boolean,p_typing boolean)
returns table(ok boolean) language sql set search_path='' as $$
 select * from public.kino_chat_activity_site('taza',p_user,p_admin,p_active,p_typing);
$$;
create or replace function public.kino_chat_clear(p_user bigint,p_through bigint)
returns table(deleted bigint) language sql set search_path='' as $$
 select * from public.kino_chat_clear_site('taza',p_user,p_through);
$$;
create or replace function public.kino_chat_inbox(p_search text default '',p_offset integer default 0)
returns table(user_id bigint,phone text,label text,browser_no bigint,message text,has_image boolean,sender text,updated_at timestamptz,unread bigint)
language sql stable set search_path='' as $$
 select * from public.kino_chat_inbox_site('taza',p_search,p_offset);
$$;
create or replace function public.kino_chat_send(p_user bigint,p_sender text,p_message text,p_image text,p_client uuid)
returns table(id bigint,user_id bigint,sender text,message text,has_image boolean,client_id uuid,created_at timestamptz,read_at timestamptz)
language sql set search_path='' as $$
 select * from public.kino_chat_send_site('taza',p_user,p_sender,p_message,p_image,p_client);
$$;
create or replace function public.kino_chat_unread(p_user bigint,p_admin boolean)
returns table(unread bigint) language sql stable set search_path='' as $$
 select * from public.kino_chat_unread_site('taza',p_user,p_admin);
$$;
create or replace function public.kino_chat_view(p_user bigint,p_admin boolean)
returns table(messages jsonb,peer_online boolean,peer_typing boolean)
language sql stable set search_path='' as $$
 select * from public.kino_chat_view_site('taza',p_user,p_admin);
$$;
create or replace function public.kino_chat_grant(p_user bigint,p_plan text,p_film bigint,p_request uuid)
returns table(payment_id bigint,plan text,film_id bigint,expires_at timestamptz)
language sql set search_path='' as $$
 select * from public.kino_chat_grant_site('taza',p_user,p_plan,p_film,p_request);
$$;
create or replace function public.kino_chat_wallet_credit(p_user bigint,p_amount integer,p_request uuid)
returns table(payment_id bigint,amount integer,balance bigint,message_id bigint)
language sql set search_path='' as $$
 select * from public.kino_chat_wallet_credit_site('taza',p_user,p_amount,p_request);
$$;

-- Preserve memberships and site-separated chat when a guest becomes a registered user.
create or replace function public.kino_merge_guest_account(p_guest bigint,p_user bigint)
returns table(balance bigint)
language plpgsql
set search_path=''
as $$
declare guest_row public.users; user_row public.users;
begin
  if p_guest is null or p_user is null then raise exception 'Invalid merge users' using errcode='22023'; end if;
  if p_guest=p_user then
    return query select coalesce(sum(w.delta),0)::bigint from public.wallet_ledger w where w.user_id=p_user; return;
  end if;

  perform 1 from public.users where id in(p_guest,p_user) order by id for update;
  select * into guest_row from public.users where id=p_guest;
  select * into user_row from public.users where id=p_user;
  if guest_row.id is null or guest_row.is_guest is not true then raise exception 'Source is not a guest' using errcode='P0409'; end if;
  if user_row.id is null or user_row.is_guest is true then raise exception 'Target account invalid' using errcode='P0409'; end if;

  update public.pending_payments set user_id=p_user,
    phone=case when phone like 'guest-%' or phone is null then user_row.phone else phone end
  where user_id=p_guest;
  update public.wallet_ledger set user_id=p_user where user_id=p_guest;
  update public.bank_sms_receipts set user_id=p_user where user_id=p_guest;
  update public.contact_messages set user_id=p_user where user_id=p_guest;
  update public.subscriptions set user_id=p_user::text where user_id=p_guest::text;

  insert into public.site_user_memberships(site_id,user_id,first_seen_at,last_seen_at)
  select site_id,p_user,first_seen_at,last_seen_at from public.site_user_memberships where user_id=p_guest
  on conflict(site_id,user_id) do update
    set first_seen_at=least(public.site_user_memberships.first_seen_at,excluded.first_seen_at),
        last_seen_at=greatest(public.site_user_memberships.last_seen_at,excluded.last_seen_at);
  delete from public.site_user_memberships where user_id=p_guest;

  delete from public.push_subscriptions g
   where g.user_id=p_guest and exists(
    select 1 from public.push_subscriptions t
    where t.user_id=p_user and t.site_id=g.site_id and t.endpoint=g.endpoint
   );
  update public.push_subscriptions set user_id=p_user where user_id=p_guest;

  insert into public.support_threads(
    site_id,user_id,updated_at,rate_start,rate_count,user_seen_at,admin_seen_at,user_typing_at,admin_typing_at
  )
  select site_id,p_user,updated_at,rate_start,rate_count,user_seen_at,admin_seen_at,user_typing_at,admin_typing_at
  from public.support_threads where user_id=p_guest
  on conflict(site_id,user_id) do update set
    updated_at=greatest(public.support_threads.updated_at,excluded.updated_at),
    rate_start=least(public.support_threads.rate_start,excluded.rate_start),
    rate_count=greatest(public.support_threads.rate_count,excluded.rate_count),
    user_seen_at=case when public.support_threads.user_seen_at is null then excluded.user_seen_at when excluded.user_seen_at is null then public.support_threads.user_seen_at else greatest(public.support_threads.user_seen_at,excluded.user_seen_at) end,
    admin_seen_at=case when public.support_threads.admin_seen_at is null then excluded.admin_seen_at when excluded.admin_seen_at is null then public.support_threads.admin_seen_at else greatest(public.support_threads.admin_seen_at,excluded.admin_seen_at) end,
    user_typing_at=case when public.support_threads.user_typing_at is null then excluded.user_typing_at when excluded.user_typing_at is null then public.support_threads.user_typing_at else greatest(public.support_threads.user_typing_at,excluded.user_typing_at) end,
    admin_typing_at=case when public.support_threads.admin_typing_at is null then excluded.admin_typing_at when excluded.admin_typing_at is null then public.support_threads.admin_typing_at else greatest(public.support_threads.admin_typing_at,excluded.admin_typing_at) end;

  delete from public.support_messages g
   where g.user_id=p_guest and exists(
    select 1 from public.support_messages t
    where t.site_id=g.site_id and t.user_id=p_user and t.sender=g.sender and t.client_id=g.client_id
   );
  update public.support_messages set user_id=p_user where user_id=p_guest;
  delete from public.support_threads where user_id=p_guest;

  update public.guest_device_tokens set user_id=p_user,updated_at=clock_timestamp() where user_id=p_guest;
  update public.app_sessions set user_id=p_user where user_id=p_guest;
  delete from public.users where id=p_guest;

  return query select coalesce(sum(w.delta),0)::bigint from public.wallet_ledger w where w.user_id=p_user;
end $$;

revoke all on function public.kino_chat_activity_site(text,bigint,boolean,boolean,boolean) from public,anon,authenticated;
revoke all on function public.kino_chat_clear_site(text,bigint,bigint) from public,anon,authenticated;
revoke all on function public.kino_chat_inbox_site(text,text,integer) from public,anon,authenticated;
revoke all on function public.kino_chat_send_site(text,bigint,text,text,text,uuid) from public,anon,authenticated;
revoke all on function public.kino_chat_unread_site(text,bigint,boolean) from public,anon,authenticated;
revoke all on function public.kino_chat_view_site(text,bigint,boolean) from public,anon,authenticated;
revoke all on function public.kino_chat_grant_site(text,bigint,text,bigint,uuid) from public,anon,authenticated;
revoke all on function public.kino_chat_wallet_credit_site(text,bigint,integer,uuid) from public,anon,authenticated;
grant execute on function public.kino_chat_activity_site(text,bigint,boolean,boolean,boolean) to service_role;
grant execute on function public.kino_chat_clear_site(text,bigint,bigint) to service_role;
grant execute on function public.kino_chat_inbox_site(text,text,integer) to service_role;
grant execute on function public.kino_chat_send_site(text,bigint,text,text,text,uuid) to service_role;
grant execute on function public.kino_chat_unread_site(text,bigint,boolean) to service_role;
grant execute on function public.kino_chat_view_site(text,bigint,boolean) to service_role;
grant execute on function public.kino_chat_grant_site(text,bigint,text,bigint,uuid) to service_role;
grant execute on function public.kino_chat_wallet_credit_site(text,bigint,integer,uuid) to service_role;

notify pgrst,'reload schema';
