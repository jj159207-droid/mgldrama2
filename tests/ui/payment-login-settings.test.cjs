const assert=require('node:assert/strict');
const {test}=require('node:test');
const {readFileSync}=require('node:fs');
const path=require('node:path');
const repo=path.resolve(__dirname,'../..');
const page=readFileSync(path.join(repo,'app/page.tsx'),'utf8');
const settings=readFileSync(path.join(repo,'app/api/settings/route.ts'),'utf8');

test('admin payment settings edit only the Mongolian IBAN',()=>{
  assert.match(page,/💳 Төлбөрийн IBAN/);
  assert.match(page,/IBAN дансны дугаар/);
  assert.match(page,/bankIban:iban/);
  assert.match(page,/MN03 0005 00 5251258979/);
  assert.doesNotMatch(page,/setBankName/);
  assert.doesNotMatch(page,/setAccountName/);
  assert.match(settings,/FIXED_BANK_NAME/);
  assert.match(settings,/FIXED_ACCOUNT_NAME/);
  assert.match(settings,/new Set\(\['messengerUrl','bankIban','bankIbn'\]\)/);
});

test('checkout loads and copies the saved IBAN instead of the legacy account number',()=>{
  assert.match(page,/const \[bankAccount,setBankAccount\]=useState\(DEFAULT_BANK_ACCOUNT\)/);
  assert.match(page,/requestJson\("\/api\/settings",\{\},true\)/);
  assert.match(page,/bankAccount\.iban/);
  assert.match(page,/copyText\(bankAccount\.iban,"account"\)/);
  assert.doesNotMatch(page,/bankAccount\.number/);
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

test('completed phone and registration PIN fields advance focus automatically',()=>{
  assert.match(page,/next\.length===8\)document\.getElementById\("user-pin"\)\?\.focus\(\)/);
  assert.match(page,/register&&next\.length===4\)document\.getElementById\("user-pin2"\)\?\.focus\(\)/);
});

test('site settings endpoint permits optional Messenger and validates only the IBAN bank field',()=>{
  assert.match(settings,/messengerRaw\?safeUrl\(messengerRaw\):''/);
  assert.match(settings,/\^MN\\d\{18\}\$/);
  assert.match(settings,/зөвхөн IBAN дугаар өөрчилнө/);
  assert.match(settings,/kino_save_settings/);
});
