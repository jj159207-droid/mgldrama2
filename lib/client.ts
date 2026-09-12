export class RequestError extends Error {
  constructor(message: string, public status: number, public code = 'REQUEST_FAILED') { super(message); }
}

export async function requestJson(path: string, opts: RequestInit = {}, quiet = false) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  opts.signal?.addEventListener('abort', abort, { once: true });
  if (opts.signal?.aborted) abort();
  const timer = setTimeout(abort, 20000);
  try {
    const headers = new Headers(opts.headers);
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    const res = await fetch(path, { ...opts, headers, credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch { throw new RequestError('Серверээс буруу хариу ирлээ.', res.status); }
    if (!res.ok) throw new RequestError(data?.message || `Хүсэлт амжилтгүй (${res.status}).`, res.status, data?.code);
    return data;
  } catch (error) {
    const message = controller.signal.aborted ? 'Хүсэлт зогссон эсвэл хүлээх хугацаа дууссан. Дахин оролдоно уу.' : error instanceof TypeError ? 'Сервертэй холбогдож чадсангүй. Холболтоо шалгаад дахин оролдоно уу.' : error instanceof Error ? error.message : 'Холболтын алдаа.';
    if (!quiet && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('kinoError', { detail: message }));
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
export async function dbAll(path:string):Promise<Record<string,unknown>[]> {
  const [table,query='']=path.split('?');const params=new URLSearchParams(query);
  const select=params.get('select');
  if(select&&select!=='*'&&!select.split(',').includes('id'))params.set('select',`id,${select}`);
  params.set('order','id.desc');params.set('limit','200');params.delete('offset');
  const result:Record<string,unknown>[]=[];let last=Number.MAX_SAFE_INTEGER;
  for(;;){
    params.set('id',`lt.${last}`);
    const rows=await dbFetch(`${table}?${params}`);
    if(!Array.isArray(rows))throw new RequestError('Жагсаалтын формат буруу байна.',502);
    if(!rows.length)return result;
    const next=Number(rows[rows.length-1].id);
    if(!Number.isSafeInteger(next)||next<=0||next>=last)throw new RequestError('Жагсаалтыг бүрэн ачаалж чадсангүй.',502);
    result.push(...rows);last=next;
  }
}
