// Mongolia follows ISO 13616: MN + 2 check digits + 4 bank digits + 12 account digits.
// Validate the international MOD-97 checksum. This proves format integrity,
// not bank-account ownership or that the recipient's bank has issued the IBAN.
export function normalizeMongolianIban(value:unknown):string{
  if(typeof value!=='string')return '';
  const iban=value.toUpperCase().replace(/\s+/g,'');
  if(!/^MN\d{18}$/.test(iban))return '';
  let remainder=0;
  for(const character of iban.slice(4)+iban.slice(0,4)){
    const numeric=/[A-Z]/.test(character)?String(character.charCodeAt(0)-55):character;
    for(const digit of numeric)remainder=(remainder*10+Number(digit))%97;
  }
  return remainder===1?iban:'';
}
