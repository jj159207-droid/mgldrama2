-- TAZA's private 10,000 MNT chat membership is a separate purchase, never a movie entitlement.
create table if not exists public.taza_secret_chat_members (
 id bigint generated always as identity primary key,
 user_id bigint not null unique references public.users(id),
 payment_id bigint not null unique references public.pending_payments(id),
 phone text not null check (phone ~ '^[0-9]{8}$'),
 blocked boolean not null default false,
 created_at timestamptz not null default now()
);
create index if not exists taza_secret_chat_members_created_idx on public.taza_secret_chat_members(created_at desc);

create table if not exists public.taza_secret_chat_messages (
 id bigint generated always as identity primary key,
 member_id bigint not null references public.taza_secret_chat_members(id),
 user_id bigint not null references public.users(id),
 client_id uuid not null unique,
 body text not null check (char_length(body) between 1 and 600),
 created_at timestamptz not null default now()
);
create index if not exists taza_secret_chat_messages_recent_idx on public.taza_secret_chat_messages(id desc);
create index if not exists taza_secret_chat_messages_author_time_idx on public.taza_secret_chat_messages(user_id,created_at desc);

alter table public.taza_secret_chat_members enable row level security;
alter table public.taza_secret_chat_messages enable row level security;
revoke all on public.taza_secret_chat_members, public.taza_secret_chat_messages from public,anon,authenticated;
revoke all on sequence public.taza_secret_chat_members_id_seq,public.taza_secret_chat_messages_id_seq from public,anon,authenticated;
grant select,insert,update,delete on public.taza_secret_chat_members,public.taza_secret_chat_messages to service_role;
grant usage,select on sequence public.taza_secret_chat_members_id_seq,public.taza_secret_chat_messages_id_seq to service_role;

create or replace function public.kino_secret_chat_require_paid()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
 if not exists (
   select 1 from public.pending_payments p
   where p.id=new.payment_id
     and p.user_id=new.user_id
     and p.site_id='taza'
     and p.plan='secret_chat_10000'
     and p.amount=10000
     and p.status='confirmed'
 ) then
   raise exception 'Verified secret chat payment required' using errcode='23514';
 end if;
 return new;
end;
$$;
drop trigger if exists taza_secret_chat_require_paid on public.taza_secret_chat_members;
create trigger taza_secret_chat_require_paid before insert or update of payment_id,user_id
on public.taza_secret_chat_members for each row execute function public.kino_secret_chat_require_paid();
revoke all on function public.kino_secret_chat_require_paid() from public,anon,authenticated;

comment on table public.taza_secret_chat_members is 'Private phone numbers given after confirmed 10k bank receipt. Never expose phone in group messages.';
comment on table public.taza_secret_chat_messages is 'Text-only paid secret chat, visible only to confirmed, unblocked members through server endpoints.';
