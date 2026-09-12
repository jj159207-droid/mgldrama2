begin;
alter table public.users add column if not exists access_blocked boolean not null default false;
update public.users set access_blocked=false where access_blocked=true;
-- Compatibility for older server code: cancel only the selected purchase.
create or replace function public.kino_block_access(payment_ref text)
returns setof public.pending_payments
language sql security definer set search_path = public
as $$
  update public.pending_payments set status='revoked'
  where ref_code=payment_ref returning *;
$$;
revoke all on function public.kino_block_access(text) from public, anon, authenticated;
grant execute on function public.kino_block_access(text) to service_role;
notify pgrst, 'reload schema';
commit;
