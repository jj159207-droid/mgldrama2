import assert from 'node:assert/strict';
import {afterEach, test} from 'node:test';
import {paymentBankSettings} from '../lib/bank-details';
import {normalizeMongolianIban} from '../lib/iban';

const oldBank={bank_name:'Хаан банк',bank_account:'5251258979',bank_iban:'MN03000500',account_name:'Т.Жаргалбаяр'};
const newBank={bank_name:'Хаан банк',bank_account:'5252017169',bank_iban:'MN440005005252017169',account_name:'Т.Жаргалбаяр'};
const oldAccount=process.env.TAZA_BANK_ACCOUNT,oldIban=process.env.TAZA_BANK_IBAN;
afterEach(()=>{
 if(oldAccount===undefined)delete process.env.TAZA_BANK_ACCOUNT;
 else process.env.TAZA_BANK_ACCOUNT=oldAccount;
 if(oldIban===undefined)delete process.env.TAZA_BANK_IBAN;
 else process.env.TAZA_BANK_IBAN=oldIban;
});
const configure=()=>{
 process.env.TAZA_BANK_ACCOUNT='5252017169';
 process.env.TAZA_BANK_IBAN='MN440005005252017169';
};
test('provided Khan Bank IBAN has valid MOD-97 checksum and matches the account number',()=>{
 assert.equal(normalizeMongolianIban('MN440005005252017169'),'MN440005005252017169');
 assert.equal('MN440005005252017169'.slice(4,8),'0005');
 assert.equal('MN440005005252017169'.slice(-10),'5252017169');
});
test('production bank config replaces only TAZA outdated, invalid legacy payment details',()=>{
 configure();
 assert.deepEqual(paymentBankSettings(oldBank,'taza'),newBank);
 assert.deepEqual(paymentBankSettings(undefined,'taza'),{bank_account:newBank.bank_account,bank_iban:newBank.bank_iban});
 assert.deepEqual(paymentBankSettings(oldBank,'kino-drama'),oldBank);
});
test('updated user bank details from admin DB always take precedence over fallback',()=>{
 configure();
 const explicit={...newBank,bank_account:'1234567890',bank_iban:'MN121234123456789123'};
 assert.deepEqual(paymentBankSettings(explicit,'taza'),explicit);
 assert.deepEqual(paymentBankSettings(newBank,'taza'),newBank);
});
test('do not use invalid bank, mismatched account, or invalid IBAN',()=>{
 configure();
 process.env.TAZA_BANK_IBAN='MN03000500';
 assert.deepEqual(paymentBankSettings(oldBank,'taza'),oldBank);
 process.env.TAZA_BANK_IBAN='MN440005005252017169';
 process.env.TAZA_BANK_ACCOUNT='5252017170';
 assert.deepEqual(paymentBankSettings(oldBank,'taza'),oldBank);
 process.env.TAZA_BANK_ACCOUNT='something';
 assert.deepEqual(paymentBankSettings(oldBank,'taza'),oldBank);
});
