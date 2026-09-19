set local lock_timeout='5s';
set local statement_timeout='30s';

create index if not exists bank_sms_receipts_source_payment_idx
  on public.bank_sms_receipts(source_payment_id);

create index if not exists bank_sms_receipts_user_idx
  on public.bank_sms_receipts(user_id);
