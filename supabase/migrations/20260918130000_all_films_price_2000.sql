-- Set all movie selling prices to 2,000 MNT and make 2,000 the default for new films.
alter table public.films alter column price set default 2000;
update public.films set price=2000 where price is distinct from 2000;
notify pgrst,'reload schema';
