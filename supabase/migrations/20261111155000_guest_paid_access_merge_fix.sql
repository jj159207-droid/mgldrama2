-- Preserve purchased TAZA film claims and private-chat membership when a paid guest
-- account is linked to a registered phone/PIN account.
-- Patch the existing reviewed merge procedure, retaining its locks and grant model.
DO $migration$
DECLARE
  definition text;
  anchor text := '  update public.guest_device_tokens set user_id=p_user,updated_at=clock_timestamp() where user_id=p_guest;';
  patch text := $addition$
  -- Bundle selections belong to the paid receipt after the guest is merged.
  update public.taza_pack_claims set user_id=p_user where user_id=p_guest;

  -- Paid chat membership and messages reference the old user through foreign
  -- keys. Transfer these before deleting the old guest. If the target already
  -- has a membership, retain that membership and attach guest messages to it.
  if exists(select 1 from public.taza_secret_chat_members where user_id=p_guest) then
    if exists(select 1 from public.taza_secret_chat_members where user_id=p_user) then
      update public.taza_secret_chat_messages
         set user_id=p_user,
             member_id=(select id from public.taza_secret_chat_members where user_id=p_user)
       where user_id=p_guest;
      update public.taza_secret_chat_members t
         set blocked=t.blocked or (select g.blocked from public.taza_secret_chat_members g where g.user_id=p_guest)
       where t.user_id=p_user;
      delete from public.taza_secret_chat_members where user_id=p_guest;
    else
      update public.taza_secret_chat_members set user_id=p_user where user_id=p_guest;
      update public.taza_secret_chat_messages set user_id=p_user where user_id=p_guest;
    end if;
  end if;

  update public.guest_device_tokens set user_id=p_user,updated_at=clock_timestamp() where user_id=p_guest;
$addition$;
BEGIN
  SELECT pg_get_functiondef('public.kino_merge_guest_account(bigint,bigint)'::regprocedure)
    INTO definition;
  IF position('update public.taza_pack_claims set user_id=p_user where user_id=p_guest' in definition)>0 THEN
    RETURN;
  END IF;
  IF position(anchor in definition)=0 THEN
    RAISE EXCEPTION 'Unexpected guest merge function; refusing unsafe replacement';
  END IF;
  definition := replace(definition,anchor,patch);
  EXECUTE definition;
END
$migration$;
