export const APP_VERSION='2026-09-12.1';
export function configurationChecks(){
  const env=process.env;
  let https=false;
  try{const u=new URL(env.SITE_URL||'');https=u.protocol==='https:'&&u.pathname==='/'&&!u.search&&!u.hash&&!u.username&&!u.password;}catch{}
  return [
    {name:'site_https',ok:https,label:'Сайтын HTTPS хаяг тохируулсан'},
    {name:'production',ok:env.NODE_ENV==='production',label:'Үйлдвэрлэлийн горимоор ажиллаж байгаа'},
    {name:'admin_secret',ok:(env.ADMIN_PASSWORD||'').length>=16,label:'Админы нууц үг тохируулсан'},
    {name:'sms_secret',ok:(env.SMS_WEBHOOK_SECRET||'').length>=32,label:'SMS-ийн нууц түлхүүр тохируулсан'},
    {name:'sms_sender',ok:!!env.SMS_ALLOWED_SENDER?.trim(),label:'Банкны SMS илгээгч тохируулсан'},
    {name:'private_secrets',ok:!Object.entries(env).some(([k,v])=>k.startsWith('NEXT_PUBLIC_')&&/SECRET|SERVICE_ROLE|PASSWORD|ADMIN_PIN|SMS_WEBHOOK/i.test(k)&&v),label:'Нууц түлхүүрүүд серверийн тохиргоонд байгаа'},
  ];
}
