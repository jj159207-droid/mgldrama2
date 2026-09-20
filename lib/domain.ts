export type Row = Record<string, unknown>;
export const isRow = (v: unknown): v is Row => !!v && typeof v === 'object' && !Array.isArray(v);
export const plans: Record<string, number> = {
  erotic_3day:8000,gadaad_3day:8000,hyatad_3day:8000,oros_3day:8000,
  erotic_1month:12500,gadaad_1month:12500,hyatad_1month:12500,oros_1month:12500,all_1month:20000,
  all_48h:8000,
  wallet_topup:5000,
};
export function planLabel(plan: string): string {
  const names: Record<string,string> = {
    erotic_3day:'Эротик · 3 хоног', gadaad_3day:'Гадаад · 3 хоног', hyatad_3day:'Хятад · 3 хоног', oros_3day:'Орос · 3 хоног',
    erotic_1month:'Эротик · 30 хоног', gadaad_1month:'Гадаад · 30 хоног', hyatad_1month:'Хятад · 30 хоног', oros_1month:'Орос · 30 хоног',
    all_1month:'Бүх багц · 1 сар', all_48h:'Бүх кино · 48 цаг', wallet_topup:'Үлдэгдэл цэнэглэлт', monthly:'Сарын багц', '1month':'Сарын багц', '3day':'3 хоногийн багц', '1year':'Жилийн багц', single:'Нэг кино',
  };
  return names[plan] || plan;
}
export function paymentExpiry(p: Row): number {
  if (p.status !== 'confirmed') return 0;
  const plan = String(p.plan || 'single');
  const date = Date.parse(String(p.confirmed_at || p.created_at || ''));
  if (!Number.isFinite(date)) return 0;
  if (plan === 'all_48h') return date + 48 * 3600000;
  const days = plan === 'single' || plan === '3day' || plan.endsWith('_3day') ? 3 : plan === '1year' ? 365 : 30;
  return date + days * 86400000;
}
export function accessFromPayments(payments: Row[], now = Date.now()): Record<string, number> {
  const access: Record<string, number> = {};
  const add = (key: string, expiry: number) => { access[key] = Math.max(access[key] || 0, expiry); };
  for (const p of payments) {
    const expiry = paymentExpiry(p); if (expiry <= now) continue;
    const plan = String(p.plan || 'single');
    if (['monthly','1month','3day','1year','all_48h'].includes(plan)) add('monthly', expiry);
    else if (plan === 'all_1month') for (const cat of ['erotic','gadaad','hyatad','oros']) add(`cat_${cat}`,expiry);
    else if (/^(erotic|gadaad|hyatad|oros)_(3day|1month)$/.test(plan)) add(`cat_${plan.split('_')[0]}`, expiry);
    else if (plan === 'single' && p.film_id) add(`film_${p.film_id}`, expiry);
  }
  return access;
}
export function canWatch(film: Row, payments: Row[], now = Date.now()): boolean {
  if (film.free === true || film.locked === false) return true;
  const access = accessFromPayments(payments,now);
  const cat = String(film.badge || '').split('|')[1] || 'Эротик';
  const key = ({'Эротик':'erotic','Гадаад':'gadaad','Хятад':'hyatad','Орос':'oros'} as Record<string,string>)[cat];
  return (access.monthly || 0) > now || (access[`film_${film.id}`] || 0) > now || (access[`cat_${key}`] || 0) > now;
}
export function safeUrl(value: unknown, image = false): string {
  if (typeof value !== 'string' || !value.trim()) return '';
  const text = value.trim();
  if (image && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(text) && text.length <= 2800000) return text;
  try { const u = new URL(text); return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; } catch { return ''; }
}
export function parseBankSms(text: string): {ref: string; amount: number} | null {
  // Accept the common Khan/Mongolian variants while still requiring an explicitly
  // labelled incoming amount and a labelled six-digit transfer reference.
  const normalized=String(text||'')
    .normalize('NFKC')
    .replace(/\u00a0/g,' ')
    .replace(/[：﹕]/g,':')
    .replace(/[，]/g,',');

  const refMatches=[...normalized.matchAll(/(?:Гүйлгээний\s*утга|Guilgeenii\s*utga|Утга|\bUtga)\s*[:=\-]?\s*(\d{6})(?!\d)/giu)];
  const refs=[...new Set(refMatches.map(match=>match[1]))];
  if(refs.length!==1)return null;

  const amountMatches=[...normalized.matchAll(/(?:\bORLOGO|Орлого|Орлогын\s*дүн)\s*[:=\-]?\s*\+?\s*(\d{1,3}(?:(?:,|\s)\d{3})+|\d+)(?:\.(\d{1,2}))?\s*(?:MNT\b|₮|төг(?:рөг)?)/giu)];
  const amounts=amountMatches.map(match=>{
    const whole=match[1].replace(/[\s,]/g,'');
    const value=Number(whole+'.'+(match[2]||'0'));
    return value;
  }).filter(value=>Number.isFinite(value)&&value>0);
  const uniqueAmounts=[...new Set(amounts)];
  if(uniqueAmounts.length!==1)return null;

  const amount=uniqueAmounts[0];
  return Number.isSafeInteger(amount) ? {ref:refs[0],amount} : null;
}
