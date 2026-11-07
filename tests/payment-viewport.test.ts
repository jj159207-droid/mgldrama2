import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

test('mobile TAZA checkout stays in viewport without sideways scrolling',()=>{
 const css=readFileSync(new URL('../app/wallet.css',import.meta.url),'utf8');
 assert.match(css,/\.film-reference-page \.detail-payment > \.checkout-inline\.wallet-single-fullscreen\s*\{[\s\S]*?width:\s*100%\s*!important/);
 assert.match(css,/\.film-reference-page \.detail-payment > \.checkout-inline\.wallet-single-fullscreen\s*\{[\s\S]*?overflow-x:\s*hidden\s*!important/);
 assert.match(css,/\.film-reference-page \.detail-payment > \.checkout-inline\.wallet-single-fullscreen\s*\{[\s\S]*?touch-action:\s*pan-y/);
 assert.match(css,/\.wallet-single-fullscreen \.wallet-single-copy strong\s*\{[\s\S]*?overflow-wrap:\s*anywhere/);
 assert.ok(!/width:\s*100vw\s*!important;\s*height:\s*100dvh/.test(css));
});
test('responsive payment proof images cannot widen their container',()=>{
 const css=readFileSync(new URL('../app/globals.css',import.meta.url),'utf8');
 assert.ok(css.includes('.payment-proof-preview img{max-width:100%;'));
});
