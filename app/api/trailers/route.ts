import { createHash } from 'node:crypto';
import { NextRequest } from 'next/server';
import ffmpeg from 'ffmpeg-static';
import { ApiError, bodyJson, db, fail, json, originCheck, session, supabaseConfig } from '@/lib/server';
import { createBunnyClip, MAX_CLIP_BYTES, parseBunnySource, TrailerError } from '@/lib/trailer-media';
import { TRAILER_SECONDS, validTrailerStart } from '@/lib/trailer-spec';
export const runtime = 'nodejs';
export const maxDuration = 180;
let busy = false;
export async function POST(req: NextRequest) {
  let acquired = false;
  try {
    originCheck(req);
    if (!(await session(req))?.admin) throw new ApiError(403, 'Админы эрх шаардлагатай.');
    const body = await bodyJson(req, 4096);
    if (Object.keys(body).some(k => !['filmId', 'sourceUrl', 'startSeconds'].includes(k))
      || !Number.isSafeInteger(body.filmId) || Number(body.filmId) <= 0 || typeof body.sourceUrl !== 'string' || !validTrailerStart(body.startSeconds))
      throw new ApiError(400, 'Кино, видео холбоос болон эхлэх цагийг зөв оруулна уу.');
    const source = parseBunnySource(body.sourceUrl);
    const [film] = await db(`films?id=eq.${body.filmId}&select=id`);
    if (!film) throw new ApiError(404, 'Кино олдсонгүй.');
    if (busy) throw new ApiError(429, 'Өөр трейлэр үүсгэж байна. Дууссаны дараа дахин оролдоно уу.');
    busy = true; acquired = true;
    const { url, headers } = supabaseConfig();
    const hash = createHash('sha256').update(JSON.stringify(['clip-v1', body.filmId, source.identity, body.startSeconds])).digest('hex');
    const path = `v1/${hash}.mp4`;
    const publicUrl = `${url}/storage/v1/object/public/kino-trailers/${path}`;
    const result = () => json({ previewUrl: `${publicUrl}#taza-trailer=1&start=${body.startSeconds}`, startSeconds: body.startSeconds, durationSeconds: TRAILER_SECONDS });
    const cached = await fetch(publicUrl, { method: 'HEAD', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (cached.ok) return result();
    if (![400, 404].includes(cached.status)) throw new ApiError(502, 'Трейлэрийн сантай холбогдож чадсангүй.');
    if (!ffmpeg) throw new ApiError(503, 'FFmpeg тохиргоо дутуу байна.', 'TRAILER_SETUP_REQUIRED');
    const clip = await createBunnyClip(source, body.startSeconds, ffmpeg, process.env.SITE_URL);
    if (clip.length > MAX_CLIP_BYTES) throw new ApiError(413, 'Бичлэгийн хэмжээ хэт том байна.');
    const upload = await fetch(`${url}/storage/v1/object/kino-trailers/${path}`, {
      method: 'POST', headers: { ...headers, 'Content-Type': 'video/mp4', 'Cache-Control': 'max-age=31536000', 'x-upsert': 'false' },
      body: new Uint8Array(clip), redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(20000),
    });
    const data = await upload.json().catch(() => null);
    const duplicate = [data?.error, data?.code].some(v => ['Duplicate', 'ResourceAlreadyExists', 'KeyAlreadyExists'].includes(v));
    if (!upload.ok && !duplicate) throw new ApiError(502, 'Трейлэр хадгалагдсангүй. kino-trailers сангийн тохиргоог шалгана уу.', 'TRAILER_STORAGE_FAILED');
    const visible = await fetch(publicUrl, { method: 'HEAD', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (!visible.ok) throw new ApiError(502, 'Бичлэг байршуулсан боловч нийтэд нээгдэхгүй байна.', 'TRAILER_STORAGE_FAILED');
    return result();
  } catch (error) {
    return fail(error instanceof TrailerError ? new ApiError(422, error.message, 'TRAILER_GENERATION_FAILED') : error);
  } finally { if (acquired) busy = false; }
}
