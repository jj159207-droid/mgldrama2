const assert=require('node:assert/strict');
const {test}=require('node:test');
const {readFileSync,existsSync}=require('node:fs');
const path=require('node:path');
const zlib=require('node:zlib');
const root=path.resolve(__dirname,'../..');
const launcher=readFileSync(path.join(root,'START-HERE.cmd'),'utf8');
const setup=readFileSync(path.join(root,'installer/TAZA-SETUP.ps1'),'utf8');
const guide=readFileSync(path.join(root,'installer/README-MN.txt'),'utf8');
const encoded=readFileSync(path.join(root,'installer/macro-template.mdr.gz.b64'),'utf8').trim();
const macro=zlib.gunzipSync(Buffer.from(encoded,'base64')).toString('utf8');

test('flash launcher uses exactly one final setup wizard',()=>{
  assert.match(launcher,/installer\\TAZA-SETUP\.ps1/);
  assert.doesNotMatch(launcher,/TAZA-SETUP-(?:V2|FINAL)\.ps1/);
  assert.ok(!existsSync(path.join(root,'installer/TAZA-SETUP-V2.ps1')));
  assert.ok(!existsSync(path.join(root,'installer/TAZA-SETUP-FINAL.ps1')));
  assert.match(setup,/C:\\TAZA-CLIENTS/);
  assert.match(setup,/excludedDirectories\s*=\s*@\('\.git',\s*'\.github',\s*'\.next',\s*'node_modules',\s*'installer'/);
  assert.match(guide,/Production ТАЗА САЙТ-ийн Supabase\/Vercel\/SMS secret-ийг энэ MASTER дотор хадгалдаггүй/);
});

test('client provisioning creates separate private cloud resources',()=>{
  assert.match(setup,/gh[\s\S]*?'repo',\s*'create'[\s\S]*?'--private'/);
  assert.match(setup,/supabase@latest',\s*'projects',\s*'create'/);
  assert.match(setup,/supabase@latest',\s*'db',\s*'push'/);
  assert.match(setup,/vercel@latest',\s*'link',\s*'--yes',\s*'--project'/);
  assert.match(setup,/vercel@latest',\s*'git',\s*'connect',\s*'--yes'/);
  for(const name of ['SUPABASE_URL','ADMIN_PASSWORD','SMS_WEBHOOK_SECRET','SMS_ALLOWED_SENDER','SITE_URL']) assert.match(setup,new RegExp(name));
  assert.match(setup,/cleanup-old-payment-records/);
  assert.match(setup,/status in \('pending','revoked'\)/);
  assert.match(setup,/coalesce\(key,''\)\s*<>\s*'site_settings'/);
});

test('MacroDroid template is sanitized and remains valid JSON',()=>{
  const parsed=JSON.parse(macro);
  assert.ok(parsed);
  assert.equal((macro.match(/__TAZA_SMS_ENDPOINT__/g)||[]).length,1);
  assert.equal((macro.match(/__TAZA_SMS_SECRET__/g)||[]).length,1);
  assert.equal((macro.match(/__TAZA_SMS_SENDER__/g)||[]).length,2);
  assert.match(macro,/Authorization/);
  assert.match(macro,/Bearer __TAZA_SMS_SECRET__/);
  assert.doesNotMatch(macro,/kino-uzeh\.vercel\.app/);
  assert.doesNotMatch(macro,/Khan Bank/);
});

test('installer has no production endpoint and creates recovery files safely',()=>{
  assert.doesNotMatch(setup,/kino-uzeh\.vercel\.app/);
  assert.match(setup,/KINO_QUEUE_TEST_V1/);
  assert.match(setup,/SMS endpoint fake test 400/);
  assert.match(setup,/CLIENT-RECOVERY\.txt/);
  assert.match(setup,/NEXT-STEPS\.txt/);
  assert.match(setup,/ServerKey/);
  assert.match(setup,/Supabase server secret\/service key нь зориуд энэ файлд бичигдээгүй/);
});
