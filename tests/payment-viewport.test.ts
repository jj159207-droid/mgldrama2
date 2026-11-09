import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

test('mobile TAZA checkout stays in viewport without sideways scrolling',()=>{
 const css=readFileSync(new URL('../app/wallet.css',import.meta.url),'utf8');
 assert.match(css,/\.film-reference-page \.detail-payment > \.checkout-inline\.wallet-single-fullscreen\s*\{[\s\S]*?width:\s*100%\s*!important/);
 assert.match(css,/\.film-reference-page \.detail-payment > \.checkout-inline\.wallet-single-fullscreen\s*\{[\s\S]*?overflow-x:\s*hidden\s*!important/);
 assert.match(css,/\.film-reference-page \.detail-payment > \.checkout-inline\.wallet-single-fullscreen\s*\{[\s\S]*?touch-action:\s*pan-y/);
 assert.match(css,/\.wallet-single-fullscreen \.wallet-single-copy strong\s*\{[\s\S]*?overflow-wrap:\s*anywhere/);
 assert.ok(!/^\s*width:\s*100vw\s*!important;\s*$/m.test(css));
});
test('retired screenshot uploader CSS is absent from TAZA checkout',()=>{
 const css=readFileSync(new URL('../app/globals.css',import.meta.url),'utf8');
 assert.doesNotMatch(css,/payment-proof-|payment-proof-preview/);
});
