const assert=require('node:assert/strict');
const {test}=require('node:test');
const {readFileSync}=require('node:fs');
const path=require('node:path');
const repo=path.resolve(__dirname,'../..');
const page=readFileSync(path.join(repo,'app/page.tsx'),'utf8');
const settings=readFileSync(path.join(repo,'app/api/settings/route.ts'),'utf8');

test('admin settings can edit the bank name, owner, and account number',()=>{
  assert.match(page,/🏦 Банкны нэр/);
  assert.match(page,/👤 Данс эзэмшигчийн нэр/);
  assert.match(page,/💳 Дансны дугаар/);
  assert.match(page,/bankName:bank,bankAccount:number,accountName:owner/);
  assert.match(settings,/bankName/);
  assert.match(settings,/bankAccount/);
  assert.match(settings,/accountName/);
});

test('checkout loads the latest saved bank settings instead of only hardcoded data',()=>{
  assert.match(page,/const \[bankAccount,setBankAccount\]=useState\(DEFAULT_BANK_ACCOUNT\)/);
  assert.match(page,/requestJson\("\/api\/settings",\{\},true\)/);
  assert.match(page,/bankAccount\.number/);
  assert.doesNotMatch(page,/const BANK_ACCOUNT =/);
  assert.doesNotMatch(page,/\bBANK_ACCOUNT\.number\b/);
});

test('package purchase dialog does not reveal movie counts',()=>{
  assert.doesNotMatch(page,/\$\{countFor\(c\.key\)\} кино/);
  assert.doesNotMatch(page,/\$\{selectedCount\} кино үзэх эрх/);
  assert.match(page,/Бүх киног үзэх эрх/);
  assert.match(page,/НЭГ БАГЦ · БҮХ КИНО/);
  assert.match(page,/ALL_MOVIES_PRICE/);
  assert.doesNotMatch(page,/Сайтын бүх кино 7,900₮/);
});

test('login and registration are presented as two clear choices with large numeric inputs',()=>{
  assert.match(page,/aria-label="Нэвтрэх эсвэл бүртгүүлэх"/);
  assert.match(page,/aria-pressed=\{!register\}/);
  assert.match(page,/aria-pressed=\{register\}/);
  assert.match(page,/placeholder="Жишээ: 99112233"/);
  assert.match(page,/Бүртгэл үүсгэх/);
  assert.match(page,/4 оронтой PIN код/);
});

test('completed phone and registration PIN fields advance focus automatically',()=>{
  assert.match(page,/next\.length===8\)document\.getElementById\("user-pin"\)\?\.focus\(\)/);
  assert.match(page,/register&&next\.length===4\)document\.getElementById\("user-pin2"\)\?\.focus\(\)/);
});

test('site settings endpoint permits optional Messenger while validating payment details',()=>{
  assert.match(settings,/messengerRaw\?safeUrl\(messengerRaw\):''/);
  assert.match(settings,/validAccount\(bankAccount\)/);
  assert.match(settings,/site_settings\?site_id=/);
  assert.match(settings,/const rows=await db\(/);
});


test('TAZA has no mandatory entry fee and admin chooses destination',()=>{
  assert.match(page,/const entryBarrier=false/);
  assert.match(page,/Үзэх эрх авах/);
  assert.match(page,/aria-label="Админ удирдах хэсэг"/);
  assert.match(page,/aria-label="Кино хэсэг"/);
  assert.match(page,/navigateTo\("admin-choice"\)/);
});
