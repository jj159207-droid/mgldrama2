import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
test('TAZA checkout does not render any payment screenshot upload control',()=>{
 const page=read('../app/page.tsx');
 assert.doesNotMatch(page,/PaymentProofUploader|\/api\/payment-proof|payment-proof-panel/);
 assert.ok(page.includes('Гүйлгээний утга'),'six-digit bank reference remains visible');
 assert.ok(page.includes('onClick={() => copyText(refCode,"ref")}'),'copy reference action remains available');
 assert.ok(page.includes('autoStatus'),'bank SMS verification status remains');
});
test('payment screenshot upload UI and endpoint are fully retired',()=>{
 assert.equal(existsSync(new URL('../app/components/PaymentProofUploader.tsx',import.meta.url)),false);
 assert.equal(existsSync(new URL('../app/api/payment-proof/route.ts',import.meta.url)),false);
 assert.doesNotMatch(read('../app/globals.css'),/payment-proof-/);
});
