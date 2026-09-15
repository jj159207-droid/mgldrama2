set local lock_timeout = '5s';
set local statement_timeout = '30s';
alter table public.support_threads
 add column user_seen_at timestamptz, add column admin_seen_at timestamptz,
 add column user_typing_at timestamptz, add column admin_typing_at timestamptz;
alter table public.support_messages add column grant_payment_id bigint references public.pending_payments(id) on delete set null;

-- Presence contains timestamps only, never the draft being typed.
create function public.kino_chat_activity(p_user bigint,p_admin boolean,p_active boolean,p_typing boolean)
returns table(ok boolean) language plpgsql security invoker set search_path = '' as $$
begin
 if p_user is null or p_admin is null or p_active is null or p_typing is null then raise exception 'Invalid activity' using errcode='22023'; end if;
 insert into public.support_threads(user_id) values(p_user) on conflict do nothing;
 if p_admin then
  update public.support_threads set admin_seen_at=case when p_active then clock_timestamp() end,
   admin_typing_at=case when p_active and p_typing then clock_timestamp() end where user_id=p_user;
 else
  update public.support_threads set user_seen_at=case when p_active then clock_timestamp() end,
   user_typing_at=case when p_active and p_typing then clock_timestamp() end where user_id=p_user;
 end if;
 return query select true;
end $$;

create function public.kino_chat_view(p_user bigint,p_admin boolean)
returns table(messages jsonb,peer_online boolean,peer_typing boolean)
language sql stable security invoker set search_path = '' as $$
 select coalesce((select jsonb_agg(to_jsonb(m) order by m.id) from
  (select id,sender,message,has_image,client_id,created_at,read_at,grant_payment_id
   from public.support_messages where user_id=p_user order by id desc limit 100) m),'[]'::jsonb),
 coalesce((select (case when p_admin then user_seen_at else admin_seen_at end)>now()-interval '35 seconds' from public.support_threads where user_id=p_user),false),
 coalesce((select (case when p_admin then user_typing_at else admin_typing_at end)>now()-interval '6 seconds' from public.support_threads where user_id=p_user),false);
$$;

-- Delete only the messages included in the admin's confirmation. New arrivals
-- survive; cascades delete photos. Payment/grant records are never deleted.
create function public.kino_chat_clear(p_user bigint,p_through bigint)
returns table(deleted bigint) language plpgsql security invoker set search_path = '' as $$
declare n bigint;
begin
 if p_user is null or p_through is null or p_through<1 then raise exception 'Invalid clear' using errcode='22023'; end if;
 perform 1 from public.support_threads where user_id=p_user for update;
 delete from public.support_messages where user_id=p_user and id<=p_through;
 get diagnostics n=row_count;
 return query select n;
end $$;

-- One atomic grant + chat receipt. Durable payment ref makes lost-response
-- retries safe even after the chat was cleared or its 100-message retention.
create function public.kino_chat_grant(p_user bigint,p_plan text,p_film bigint,p_request uuid)
returns table(payment_id bigint,plan text,film_id bigint,expires_at timestamptz)
language plpgsql security invoker set search_path = '' as $$
declare owner public.users; saved public.pending_payments; film_title text; label text; days integer; receipt bigint;
begin
 if p_user is null or p_request is null or p_plan is null or p_plan not in
  ('single','3day','all_1month','erotic_3day','gadaad_3day','hyatad_3day','erotic_1month','gadaad_1month','hyatad_1month')
 then raise exception 'Invalid grant' using errcode='22023'; end if;
 if (p_plan='single' and p_film is null) or (p_plan<>'single' and p_film is not null) then raise exception 'Invalid film' using errcode='22023'; end if;
 select * into owner from public.users where id=p_user for update;
 if not found then raise exception 'Unknown user' using errcode='P0404'; end if;
 days := case when p_plan in ('single','3day') or right(p_plan,5)='_3day' then 3 else 30 end;
 select * into saved from public.pending_payments where ref_code='chat-'||p_request::text;
 if found then
  if saved.user_id<>p_user or saved.plan<>p_plan or saved.film_id is distinct from p_film or saved.status<>'confirmed' then raise exception 'Grant changed' using errcode='P0409'; end if;
 else
  if p_plan='single' then
   select title into film_title from public.films where id=p_film;
   if not found then raise exception 'Unknown film' using errcode='P0404'; end if;
   label := '«'||left(coalesce(film_title,'Кино'),200)||'» кино · 3 хоног';
  else
   label := case split_part(p_plan,'_',1) when 'erotic' then 'Эротик' when 'gadaad' then 'Гадаад' when 'hyatad' then 'Хятад' else 'Бүх кино' end || ' · ' || days || ' хоног';
  end if;
  insert into public.pending_payments(ref_code,user_id,phone,film_id,plan,amount,status,confirmed_at)
   values('chat-'||p_request::text,p_user,owner.phone,p_film,p_plan,0,'confirmed',clock_timestamp()) returning * into saved;
  select id into receipt from public.kino_chat_send(p_user,'admin',
   '✅ Таны '||label||' үзэх эрхийг админ нээлээ. Хүчинтэй хугацаа: '||
   to_char((saved.confirmed_at+make_interval(days=>days)) at time zone 'Asia/Ulaanbaatar','YYYY-MM-DD HH24:MI')||' (Улаанбаатар).',null,p_request);
  update public.support_messages set grant_payment_id=saved.id where id=receipt;
 end if;
 return query select saved.id,p_plan,p_film,saved.confirmed_at+make_interval(days=>days);
end $$;

revoke all on function public.kino_chat_activity(bigint,boolean,boolean,boolean),public.kino_chat_view(bigint,boolean),public.kino_chat_clear(bigint,bigint),public.kino_chat_grant(bigint,text,bigint,uuid) from public,anon,authenticated;
grant execute on function public.kino_chat_activity(bigint,boolean,boolean,boolean),public.kino_chat_view(bigint,boolean),public.kino_chat_clear(bigint,bigint),public.kino_chat_grant(bigint,text,bigint,uuid) to service_role;
notify pgrst,'reload schema';
