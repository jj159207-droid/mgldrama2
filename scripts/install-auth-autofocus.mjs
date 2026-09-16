import { readFileSync, writeFileSync } from 'node:fs';

const path = 'app/page.tsx';
let source = readFileSync(path, 'utf8');

function replaceExact(label, before, after) {
  if (source.includes(after)) return;
  if (!source.includes(before)) throw new Error(`Missing ${label} integration anchor`);
  source = source.replace(before, after);
}

replaceExact(
  'phone to PIN autofocus',
  `<input id="user-phone" type="tel" inputMode="numeric" autoComplete="username" autoFocus required pattern="[0-9]{8}" maxLength={8} value={phone} onChange={e=>setPhone(e.target.value.replace(/\\D/g,""))} placeholder="Жишээ: 99112233" style={{...inputSt,padding:"15px 16px",fontSize:18}}/>`,
  `<input id="user-phone" type="tel" inputMode="numeric" autoComplete="username" autoFocus required pattern="[0-9]{8}" maxLength={8} value={phone} onChange={e=>{const next=e.target.value.replace(/\\D/g,"").slice(0,8);setPhone(next);if(next.length===8)document.getElementById("user-pin")?.focus();}} placeholder="Жишээ: 99112233" style={{...inputSt,padding:"15px 16px",fontSize:18}}/>`,
);

replaceExact(
  'PIN to confirmation autofocus',
  `<input id="user-pin" type="password" inputMode="numeric" autoComplete={register?"new-password":"current-password"} required pattern="[0-9]{4}" maxLength={4} value={pin} onChange={e=>setPin(e.target.value.replace(/\\D/g,""))} placeholder="••••" style={{...inputSt,padding:"15px 16px",fontSize:18,letterSpacing:"0.2em"}}/>`,
  `<input id="user-pin" type="password" inputMode="numeric" autoComplete={register?"new-password":"current-password"} required pattern="[0-9]{4}" maxLength={4} value={pin} onChange={e=>{const next=e.target.value.replace(/\\D/g,"").slice(0,4);setPin(next);if(register&&next.length===4)document.getElementById("user-pin2")?.focus();}} placeholder="••••" style={{...inputSt,padding:"15px 16px",fontSize:18,letterSpacing:"0.2em"}}/>`,
);

writeFileSync(path, source);
console.log('Automatic phone-to-PIN and registration PIN focus integrated.');
