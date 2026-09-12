-- Read-only audit: no keys, PINs, phone numbers or video URLs are returned.
-- Run in Supabase SQL Editor. Save the results from every statement.
select c.relname as table_name,c.relrowsecurity as rls_enabled,
 has_table_privilege('anon',c.oid,'SELECT') as anon_read,
 has_table_privilege('anon',c.oid,'INSERT,UPDATE,DELETE') as anon_write,
 has_table_privilege('authenticated',c.oid,'SELECT') as authenticated_read,
 has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE') as authenticated_write
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in
 ('users','films','pending_payments','contact_messages','sms_logs','app_sessions','app_auth_attempts')
order by c.relname;

with required(table_name,column_name) as (values
 ('users','pin'),('users','phone'),('users','user_id'),
 ('films','preview_url'),('pending_payments','plan'),('pending_payments','user_id'),
 ('pending_payments','confirmed_at'),('pending_payments','phone'),
 ('contact_messages','is_announcement'),('contact_messages','announcement_image'),
 ('sms_logs','key'),('sms_logs','value'),('sms_logs','text'),
 ('app_sessions','token_hash'),('app_sessions','expires_at'),('app_auth_attempts','bucket')
)
select r.*,c.data_type,c.is_nullable,case when c.column_name is null then 'MISSING' else 'PRESENT' end as result
from required r left join information_schema.columns c on c.table_schema='public'
 and c.table_name=r.table_name and c.column_name=r.column_name
order by r.table_name,r.column_name;

select 'duplicate_payment_refs' as check_name,count(*) as problem_groups
from (select ref_code from public.pending_payments group by ref_code having count(*)>1) q
union all
select 'duplicate_user_phones',count(*) from (select phone from public.users group by phone having count(*)>1) q
union all
select 'invalid_paid_amounts',count(*) from public.pending_payments where amount<0 or amount is null
union all
select 'legacy_account_blocks',count(*) from public.users where access_blocked=true;

select 'films_with_unknown_category' as check_name,count(*) as problem_rows
from public.films where coalesce(nullif(split_part(badge,'|',2),''),'Эротик') not in ('Эротик','Гадаад','Хятад');

select p.proname as function_name,p.prosecdef as security_definer,
 has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
 has_function_privilege('service_role',p.oid,'EXECUTE') as server_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('kino_claim_attempt','kino_block_access','kino_save_settings');

-- Review these separately: a legacy RPC may expose data even with closed tables.
select p.proname as review_public_definer_function,pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prosecdef
 and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE'));
