-- Collect a member's name, adult age and private phone only after the
-- separate 10,000 MNT secret-chat payment is confirmed.
-- No existing members at deployment time; fail migration rather than
-- silently writing fabricated personal details to existing records.
alter table public.taza_secret_chat_members
  add column if not exists full_name text,
  add column if not exists age smallint;
alter table public.taza_secret_chat_members
  alter column full_name set not null,
  alter column age set not null;
alter table public.taza_secret_chat_members
  add constraint taza_secret_chat_full_name_valid
    check (char_length(btrim(full_name)) between 2 and 80),
  add constraint taza_secret_chat_age_adult
    check (age between 18 and 120);
comment on column public.taza_secret_chat_members.full_name is 'Member-provided name; only visible to admin and the member.';
comment on column public.taza_secret_chat_members.age is 'Member-provided adult age; only visible to admin and the member.';
