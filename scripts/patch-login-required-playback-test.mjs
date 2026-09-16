import fs from 'node:fs';

const path='tests/security.test.ts';
let text=fs.readFileSync(path,'utf8');
const old="test('free playback works without account',async()=>{tables.films[0].free=true;assert.equal((await playback.GET(req('/api/playback?id=1'))).status,200);});";
const replacement=`test('full playback always requires login, while free/unlocked films need no payment after login',async()=>{\n const guest=()=>playback.GET(req('/api/playback?id=1'));\n tables.films[0].free=true;\n assert.equal((await guest()).status,403);\n const c=await register();\n assert.equal((await playback.GET(req('/api/playback?id=1','GET',undefined,c))).status,200);\n tables.films[0].free=false;tables.films[0].locked=false;\n assert.equal((await guest()).status,403);\n assert.equal((await playback.GET(req('/api/playback?id=1','GET',undefined,c))).status,200);\n});`;
if(!text.includes(old)) throw new Error('Expected free-playback test anchor not found');
text=text.replace(old,replacement);
fs.writeFileSync(path,text);
console.log('Updated playback login security test.');
