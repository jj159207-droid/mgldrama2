import './install-payment-login-settings.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
const path='app/page.tsx';
let source=readFileSync(path,'utf8');
if(source.includes('DEFAULT_bankAccount.')&&!source.includes('const DEFAULT_bankAccount =')){
  const anchor=`const DEFAULT_BANK_ACCOUNT = {\n  bank: "Хаан банк",\n  number: "5403972086",\n  name: "Т.Жаргалбаяр",\n};\n`;
  if(!source.includes(anchor))throw new Error('Missing default bank account anchor after integration');
  source=source.replace(anchor,`${anchor}const DEFAULT_bankAccount = DEFAULT_BANK_ACCOUNT;\n`);
  writeFileSync(path,source);
}
console.log('Post-integration bank-account references normalized.');
