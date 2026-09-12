-- Run in the Supabase SQL Editor. Re-runnable; does not delete images or films.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('kino-posters','kino-posters',true,200000,array['image/webp'])
on conflict(id) do update set public=true,file_size_limit=200000,allowed_mime_types=array['image/webp'];

-- Restrictive policies also protect this bucket if another application left a
-- permissive "allow all uploads" policy. Other buckets are unaffected.
drop policy if exists kino_posters_no_client_insert on storage.objects;
create policy kino_posters_no_client_insert on storage.objects as restrictive
for insert to anon,authenticated with check(bucket_id <> 'kino-posters');
drop policy if exists kino_posters_no_client_update on storage.objects;
create policy kino_posters_no_client_update on storage.objects as restrictive
for update to anon,authenticated using(bucket_id <> 'kino-posters') with check(bucket_id <> 'kino-posters');
drop policy if exists kino_posters_no_client_delete on storage.objects;
create policy kino_posters_no_client_delete on storage.objects as restrictive
for delete to anon,authenticated using(bucket_id <> 'kino-posters');

-- A migration must not overwrite a poster edited while its upload was running.
create or replace function public.kino_replace_inline_poster(target_id bigint,old_image text,new_image text)
returns table(id bigint) language sql security definer set search_path=public as $$
 update public.films f set img=new_image where f.id=target_id and f.img=old_image
 returning f.id;
$$;
revoke all on function public.kino_replace_inline_poster(bigint,text,text) from public,anon,authenticated;
grant execute on function public.kino_replace_inline_poster(bigint,text,text) to service_role;
notify pgrst,'reload schema';
commit;
