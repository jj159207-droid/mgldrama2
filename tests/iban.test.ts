import assert from 'node:assert/strict';
import {test} from 'node:test';
import {normalizeMongolianIban} from '../lib/iban';

test('20-character ISO 13616 Mongolian IBAN checksum is validated',()=>{
 const valid='MN121234123456789123'; // ISO 13616 registry's structure example.
 assert.equal(normalizeMongolianIban(valid),valid);
 assert.equal(normalizeMongolianIban('MN12 1234 1234 5678 9123'),valid);
 assert.equal(normalizeMongolianIban(valid.toLowerCase()),valid);
 assert.equal(normalizeMongolianIban('MN121234123456789124'),'','invalid check digit must be rejected');
 assert.equal(normalizeMongolianIban('MN03000500'),'','retired ten-character placeholder is not an IBAN');
 assert.equal(normalizeMongolianIban('MN'+'0'.repeat(18)),'');
 assert.equal(normalizeMongolianIban(null),'');
 assert.equal(normalizeMongolianIban(''),'');
});
