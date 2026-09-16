-- Public short trailers only. Full movie files are never stored in this bucket.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('kino-trailers','kino-trailers',true,4000000,array['video/mp4'])
on conflict (id) do nothing;
do $$ begin
 if not exists (select 1 from storage.buckets where id='kino-trailers' and public and file_size_limit=4000000 and allowed_mime_types=array['video/mp4']) then
  raise exception 'Existing kino-trailers bucket has incompatible settings';
 end if;
 if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='kino_trailers_no_client_insert') then
  create policy kino_trailers_no_client_insert on storage.objects as restrictive for insert to anon,authenticated with check (bucket_id <> 'kino-trailers');
 end if;
 if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='kino_trailers_no_client_update') then
  create policy kino_trailers_no_client_update on storage.objects as restrictive for update to anon,authenticated using (bucket_id <> 'kino-trailers') with check (bucket_id <> 'kino-trailers');
 end if;
 if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='kino_trailers_no_client_delete') then
  create policy kino_trailers_no_client_delete on storage.objects as restrictive for delete to anon,authenticated using (bucket_id <> 'kino-trailers');
 end if;
end $$;
