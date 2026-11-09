import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('TAZA full-watch offers 3 bank packages while legacy admin phone grants remain manageable',()=>{
  const landing=read('app/components/FilmLanding.tsx');
  const page=read('app/page.tsx');
  assert.match(landing,/props\.onWatch\(\)/);
  assert.match(page,/setShowPlanModal\(true\)/);
  assert.match(page,/<TazaPlanPicker/);
  assert.doesNotMatch(page,/<PhoneUnlockModal/);
  assert.match(page,/PhoneGrantsAdminTab/);
  assert.match(page,/📱 Дугаарын эрх/);
});
test('manual phone grant cannot bypass playback server validation',()=>{
  const playback=read('app/api/playback/route.ts');
  const grant=read('lib/taza-phone-access.ts');
  const claim=read('app/api/phone-grants/claim/route.ts');
  const admin=read('app/api/phone-grants/route.ts');
  assert.match(playback,/phoneGrantAllowsPlayback\(req,id\)/);
  assert.match(playback,/!isAdmin && !manuallyAllowed/);
  assert.match(grant,/taza_phone_sessions\?token_hash/);
  assert.match(grant,/active=eq\.true/);
  assert.match(claim,/film_id=is\.null/);
  assert.match(claim,/rateLimit\('taza-phone-entitlement:/);
  assert.match(claim,/httpOnly:true/);
  assert.match(claim,/secure:process\.env\.NODE_ENV/);
  assert.match(admin,/canAdminSite\(await session\(req\),site\)/);
});
test('manual phone tables are private and do not rewrite payment history',()=>{
  const sql=read('supabase/migrations/20261109053000_taza_phone_access.sql');
  assert.match(sql,/alter table public\.taza_phone_grants enable row level security/);
  assert.match(sql,/revoke all on table public\.taza_phone_grants from anon,authenticated,public/);
  assert.match(sql,/revoke all on table public\.taza_phone_sessions from anon,authenticated,public/);
  assert.doesNotMatch(sql,/drop table|delete from public\.pending_payments/i);
});
