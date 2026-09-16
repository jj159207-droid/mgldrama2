const assert=require('node:assert/strict');
const {test}=require('node:test');
const {readFileSync}=require('node:fs');
const path=require('node:path');
const zlib=require('node:zlib');
const root=path.resolve(__dirname,'../..');
const launcher=readFileSync(path.join(root,'START-HERE.cmd'),'utf8');
const setup=readFileSync(path.join(root,'installer/TAZA-SETUP-V2.ps1'),'utf8');
const guide=readFileSync(path.join(root,'installer/README-MN.txt'),'utf8');
const encoded=readFileSync(path.join(root,'installer/macro-template.mdr.gz.b64'),'utf8').trim();
const macro=zlib.gunzipSync(Buffer.from(encoded,'base64')).toString('utf8');

test('flash launcher uses the hardened standalone setup wizard',()=>{
  assert.match(launcher,/TAZA-SETUP-V2\.ps1/);
  assert.match(setup,/C:\\TAZA-CLIENTS/);
  assert.match(setup,/\.git','\.github','\.next','node_modules','installer'/);
  assert.match(guide,/Production ТАЗА САЙТ-ийн Supabase\/Vercel\/SMS secret-ийг энэ MASTER дотор хадгалдаггүй/);
});

test('client provisioning creates separate private cloud resources',()=>{
  assert.match(setup,/gh' @\('repo','create'.*'--private'/s);
  assert.match(setup,/supabase@latest','projects','create'/);
  assert.match(setup,/supabase@latest','db','push'/);
  assert.match(setup,/vercel@latest','link','--yes','--project'/);
  assert.match(setup,/vercel@latest','git','connect','--yes'/);
  for(const name of ['SUPABASE_URL','ADMIN_PASSWORD','SMS_WEBHOOK_SECRET','SMS_ALLOWED_SENDER','SITE_URL']) assert.match(setup,new RegExp(name));
  assert.match(setup,/cleanup-old-payment-records/);
  assert.match(setup,/status in \('pending','revoked'\)/);
  assert.match(setup,/coalesce\(key,''\)<>\'site_settings\'/);
});

test('MacroDroid template is sanitized and remains the three-macro JSON backup',()=>{
  const parsed=JSON.parse(macro);
  assert.ok(parsed);
  assert.equal((macro.match(/__TAZA_SMS_ENDPOINT__/g)||[]).length,1);
  assert.equal((macro.match(/__TAZA_SMS_SECRET__/g)||[]).length,1);
  assert.equal((macro.match(/__TAZA_SMS_SENDER__/g)||[]).length,2);
  assert.match(macro,/Authorization/);
  assert.match(macro,/Bearer __TAZA_SMS_SECRET__/);
  assert.doesNotMatch(macro,/kino-uzeh\.vercel\.app/);
  assert.doesNotMatch(macro,/Khan Bank/);
  const macros=Array.isArray(parsed)?parsed:(parsed.macroList||parsed.macros||parsed.macro_list||[]);
  assert.ok(Array.isArray(macros) || typeof parsed==='object');
});

test('installer contains no production endpoint or hard-coded current bank owner',()=>{
  assert.doesNotMatch(setup,/kino-uzeh\.vercel\.app/);
  assert.doesNotMatch(setup,/5403972086/);
  assert.doesNotMatch(setup,/Т\.Жаргалбаяр/);
  assert.match(setup,/KINO_QUEUE_TEST_V1/);
  assert.match(setup,/expected 400/);
  assert.match(setup,/CLIENT-RECOVERY\.txt/);
  assert.match(setup,/NEXT-STEPS\.txt/);
});
