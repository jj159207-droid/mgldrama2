import { siteFromPathname } from './site';
export class RequestError extends Error {
  constructor(message: string, public status: number, public code = 'REQUEST_FAILED') { super(message); }
}

function responseMessage(status: number, message?: string) {
  if (status === 402 || status === 503) return 'Үйлчилгээ түр боломжгүй байна. Түр хүлээгээд дахин оролдоорой.';
  if (status >= 500) return 'ТАЗА САЙТ-тай холбогдоход алдаа гарлаа. Түр хүлээгээд дахин оролдоорой.';
  if (status === 429) return 'Олон хүсэлт зэрэг ирсэн байна. Түр хүлээгээд дахин оролдоорой.';
  return message || 'Хүсэлтийг гүйцэтгэж чадсангүй. Дахин оролдоорой.';
}

export async function requestJson(path: string, opts: RequestInit = {}, quiet = false) {
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  opts.signal?.addEventListener('abort', abort, { once: true });
  if (opts.signal?.aborted) abort();
  const timer = setTimeout(() => {timedOut = true; abort();}, 20000);
  try {
    const headers = new Headers(opts.headers);
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    if (!headers.has('X-Taza-Site')) {
      const site = typeof window === 'undefined' ? 'taza' : siteFromPathname(window.location.pathname);
      headers.set('X-Taza-Site', site);
    }
    const res = await fetch(path, { ...opts, headers, credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch {
      throw new RequestError(responseMessage(res.ok ? 502 : res.status), res.ok ? 502 : res.status, 'INVALID_RESPONSE');
    }
    if (!res.ok) throw new RequestError(responseMessage(res.status, typeof data?.message === 'string' ? data.message : undefined), res.status, data?.code);
    return data;
  } catch (error) {
    // Replaced requests and unmounted screens must not produce error alerts.
    if (opts.signal?.aborted) throw error;
    const message = timedOut ? 'Холболт удаан байна. Дахин оролдоорой.' : error instanceof TypeError ? 'Интернэт холболтоо шалгаад дахин оролдоорой.' : error instanceof Error ? error.message : 'Холболтын алдаа.';
    if (!quiet && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('kinoError', { detail: message }));
    if (timedOut) throw new RequestError(message, 0, 'TIMEOUT');
    if (error instanceof TypeError) throw new RequestError(message, 0, "NETWORK_ERROR");
    throw error;
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', abort);
  }
}

export function dbFetch(path: string, opts?: RequestInit, quiet=false) {
  return requestJson(`/api/db?path=${encodeURIComponent(path)}`, opts,quiet);
}

// A Supabase response can be capped below the requested limit. Continue until
// an empty page using a stable ID cursor instead of treating a short page as EOF.
export async function dbAll(path:string, opts: RequestInit = {}, quiet = false):Promise<Record<string,unknown>[]> {
  const [table,query='']=path.split('?');const params=new URLSearchParams(query);
  const select=params.get('select');
  if(select&&select!=='*'&&!select.split(',').includes('id'))params.set('select',`id,${select}`);
  params.set('order','id.desc');params.set('limit','200');params.delete('offset');
  const result:Record<string,unknown>[]=[];let last=Number.MAX_SAFE_INTEGER;
  for(;;){
    params.set('id',`lt.${last}`);
    const rows=await dbFetch(`${table}?${params}`, opts, quiet);
    if(!Array.isArray(rows))throw new RequestError('Жагсаалтын формат буруу байна.',502);
    if(!rows.length)return result;
    const next=Number(rows[rows.length-1].id);
    if(!Number.isSafeInteger(next)||next<=0||next>=last)throw new RequestError('Жагсаалтыг бүрэн ачаалж чадсангүй.',502);
    result.push(...rows);last=next;
  }
}
