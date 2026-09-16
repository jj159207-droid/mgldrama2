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
  assert.match(page,/Тухайн ангиллын бүх кино/);
  assert.match(page,/Сонгосон багцын кинонууд/);
});

test('login and registration are presented as two clear choices with large numeric inputs',()=>{
  assert.match(page,/aria-label="Нэвтрэх эсвэл бүртгүүлэх"/);
  assert.match(page,/aria-pressed=\{!register\}/);
  assert.match(page,/aria-pressed=\{register\}/);
  assert.match(page,/placeholder="Жишээ: 99112233"/);
  assert.match(page,/Бүртгэл үүсгэх/);
  assert.match(page,/4 оронтой PIN код/);
});

test('site settings endpoint permits optional Messenger while validating payment details',()=>{
  assert.match(settings,/messengerRaw\?safeUrl\(messengerRaw\):''/);
  assert.match(settings,/validAccount\(bankAccount\)/);
  assert.match(settings,/kino_save_settings/);
});
