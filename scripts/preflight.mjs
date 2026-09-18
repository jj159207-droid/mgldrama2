import nextEnv from '@next/env';
import {readFileSync,existsSync} from 'node:fs';
nextEnv.loadEnvConfig(process.cwd());
let errors=0;
function check(name,ok){console.log((ok?'PASS':'FAIL')+' '+name);if(!ok)errors++;}
const major=Number(process.versions.node.split('.')[0]);check('Node.js 22 or 24',major===22||major===24);
const env=process.env;
function httpsOrigin(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&u.pathname==='/'&&!u.search&&!u.hash&&!['localhost','127.0.0.1'].includes(u.hostname);}catch{return false;}}
check('NEXT_PUBLIC_SITE_NAME is configured',!!env.NEXT_PUBLIC_SITE_NAME?.trim());
check('SITE_URL is the public HTTPS origin',httpsOrigin(env.SITE_URL));
check('SUPABASE_URL is an HTTPS origin',httpsOrigin(env.SUPABASE_URL||env.NEXT_PUBLIC_SUPABASE_URL));
const key=env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY||'';
let serviceKey=key.startsWith('sb_secret_')&&key.length>25;
try{serviceKey ||= JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()).role==='service_role';}catch{}
check('Supabase server secret key is configured',serviceKey&&!key.includes('REPLACE'));
check('ADMIN_PASSWORD is at least 16 characters',(env.ADMIN_PASSWORD||'').length>=16&&!env.ADMIN_PASSWORD?.includes('REPLACE'));
check('BANK_NAME is configured',!!env.BANK_NAME?.trim()&&!env.BANK_NAME?.includes('REPLACE'));
check('BANK_ACCOUNT is configured',/^[A-Za-z0-9 -]{6,40}$/.test(env.BANK_ACCOUNT||'')&&!env.BANK_ACCOUNT?.includes('REPLACE'));
check('BANK_ACCOUNT_NAME is configured',!!env.BANK_ACCOUNT_NAME?.trim()&&!env.BANK_ACCOUNT_NAME?.includes('REPLACE'));
const smsSecret=(env.SMS_WEBHOOK_SECRET||'').trim(),smsSender=(env.SMS_ALLOWED_SENDER||'').trim();
if(!smsSecret&&!smsSender)check('SMS automation disabled cleanly',true);
else{
 check('SMS_WEBHOOK_SECRET is at least 32 characters',smsSecret.length>=32&&!smsSecret.includes('REPLACE'));
 check('SMS_ALLOWED_SENDER is configured',!!smsSender);
}
check('No privileged NEXT_PUBLIC secrets',!Object.entries(env).some(([k,v])=>k.startsWith('NEXT_PUBLIC_')&&/SECRET|SERVICE_ROLE|PASSWORD|ADMIN_PIN|SMS_WEBHOOK/i.test(k)&&v));
check('Fresh client SQL exists',existsSync('supabase/CLIENT-FRESH-INSTALL.sql'));
check('Lockfile exists',existsSync('package-lock.json'));
const pkg=JSON.parse(readFileSync('package.json','utf8'));check('Production build/start scripts',pkg.scripts.build==='next build'&&pkg.scripts.start==='next start');
console.log('This checks local configuration only. It does not prove credentials are valid, TLS is live, SQL is installed, or SMS reaches the server.');
console.log('After deployment, use the admin readiness check and a real end-to-end order test. Never paste secrets into chat.');
process.exitCode=errors?1:0;
