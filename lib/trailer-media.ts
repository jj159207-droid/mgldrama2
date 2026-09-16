import { createDecipheriv } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TRAILER_SECONDS, validTrailerStart } from './trailer-spec';

export class TrailerError extends Error {}
const UUID = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
export const MAX_CLIP_BYTES = 4_000_000;
export type BunnySource = { url: URL; videoId: string; libraryId?: string; identity: string };
export function parseBunnySource(value: string): BunnySource {
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new TrailerError('Bunny.net киноны зөв HTTPS холбоос оруулна уу.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || /[%\\]/.test(url.pathname))
    throw new TrailerError('Bunny.net киноны зөв HTTPS холбоос оруулна уу.');
  if (['iframe.mediadelivery.net', 'player.mediadelivery.net', 'video.bunnycdn.com'].includes(url.hostname)) {
    const match = new RegExp(`^/(?:embed|play)/(\\d+)/(${UUID})/?$`, 'i').exec(url.pathname);
    if (!match) throw new TrailerError('Bunny Stream-ийн Embed URL-ийг бүтнээр нь оруулна уу.');
    return { url, libraryId: match[1], videoId: match[2].toLowerCase(), identity: `${match[1]}/${match[2].toLowerCase()}` };
  }
  const match = new RegExp(`^/(${UUID})/(?:playlist\\.m3u8|play_\\d+p\\.mp4)$`, 'i').exec(url.pathname);
  if (/^[a-z0-9-]+\.b-cdn\.net$/.test(url.hostname) && match) {
    return { url, videoId: match[1].toLowerCase(), identity: `${url.hostname}/${match[1].toLowerCase()}` };
  }
  throw new TrailerError('Автомат трейлэрт Bunny Stream-ийн Embed URL эсвэл playlist.m3u8 холбоос ашиглана уу.');
}

/** Only Bunny CDN paths for this same video may be fetched. Redirects are never followed. */
export function mediaUrl(value: string, base: URL, videoId: string): URL {
  let url: URL;
  try { url = new URL(value, base); } catch { throw new TrailerError('Киноны урсгалын холбоос буруу байна.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash
    || !/^[a-z0-9-]+\.b-cdn\.net$/.test(url.hostname) || /[%\\]/.test(url.pathname)
    || !url.pathname.toLowerCase().includes(`/${videoId.toLowerCase()}/`))
    throw new TrailerError('Bunny CDN-ээс өөр эсвэл өөр киноны урсгал зөвшөөрөгдөхгүй.');
  if (!url.search && url.origin === base.origin && base.search) url.search = base.search;
  return url;
}

type Key = { uri: string; iv?: string };
export type Segment = { uri: string; duration: number; at: number; sequence: number; key: Key | null; map: string | null; discontinuity: boolean };
export function parsePlaylist(text: string): { segments: Segment[]; duration: number } {
  if (!text.trimStart().startsWith('#EXTM3U') || !text.includes('#EXT-X-ENDLIST')) throw new TrailerError('Дууссан киноны HLS урсгал шаардлагатай.');
  if (/#EXT-X-(?:BYTERANGE|I-FRAMES-ONLY|PART|PRELOAD-HINT)/.test(text)) throw new TrailerError('Энэ HLS урсгалын хэсэгчлэлийн формат одоогоор дэмжигдэхгүй.');
  const segments: Segment[] = []; let at = 0, sequence = 0, duration: number | null = null, key: Key | null = null, map: string | null = null, discontinuity = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim(); if (!line) continue;
    if (line.startsWith('#EXT-X-MEDIA-SEQUENCE:')) {
      const value = line.slice(22); if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw new TrailerError('Урсгалын дараалал буруу.');
      sequence = Number(value);
    } else if (line.startsWith('#EXT-X-KEY:')) {
      if (/METHOD=NONE(?:,|$)/.test(line)) key = null;
      else {
        const uri = /URI="([^"]+)"/.exec(line)?.[1]; const iv = /IV=(0x[a-f0-9]+)/i.exec(line)?.[1];
        if (!/METHOD=AES-128(?:,|$)/.test(line) || !uri || /KEYFORMAT=/.test(line) || (iv && !/^0x[a-f0-9]{32}$/i.test(iv)))
          throw new TrailerError('DRM хамгаалалттай урсгалаас трейлэр үүсгэхгүй. Тусдаа трейлэрийн холбоос ашиглана уу.');
        key = { uri, iv };
      }
    } else if (line.startsWith('#EXT-X-MAP:')) {
      if (/BYTERANGE=/.test(line)) throw new TrailerError('Энэ HLS эхлэлийн формат дэмжигдэхгүй.');
      map = /URI="([^"]+)"/.exec(line)?.[1] || null;
      if (!map || key) throw new TrailerError('Энэ HLS эхлэлийн формат дэмжигдэхгүй.');
    } else if (line === '#EXT-X-DISCONTINUITY') discontinuity = true;
    else if (line.startsWith('#EXTINF:')) {
      duration = Number(line.slice(8).split(',')[0]);
      if (!Number.isFinite(duration) || duration <= 0 || duration > 30) throw new TrailerError('Урсгалын хэсгийн хугацаа буруу эсвэл хэт урт байна.');
    } else if (!line.startsWith('#')) {
      if (duration === null || segments.length >= 30000) throw new TrailerError('Киноны урсгалын формат буруу.');
      segments.push({ uri: line, duration, at, sequence: sequence++, key, map, discontinuity });
      at += duration; duration = null; discontinuity = false;
    }
  }
  if (!segments.length || duration !== null) throw new TrailerError('Киноны урсгал хоосон эсвэл дутуу байна.');
  return { segments, duration: at };
}
export function selectSegments(playlist: ReturnType<typeof parsePlaylist>, start: number): Segment[] {
  if (!validTrailerStart(start)) throw new TrailerError('Цаг, минут, секундийг зөв оруулна уу.');
  if (start + TRAILER_SECONDS > playlist.duration + 0.001) throw new TrailerError('Сонгосон цагаас кино дуусах хүртэл бүтэн 12 секунд байхгүй байна. Өмнөх цагийг сонгоно уу.');
  const segments = playlist.segments.filter(s => s.at + s.duration > start && s.at < start + TRAILER_SECONDS);
  if (!segments.length || segments.length > 16 || segments.slice(1).some(s => s.discontinuity || s.map !== segments[0].map))
    throw new TrailerError('Энэ хэсэгт урсгал тасарсан байна. Өөр эхлэх цаг сонгоно уу.');
  return segments;
}
export function variantUri(text: string): string | null {
  const lines = text.split(/\r?\n/).map(s => s.trim());
  const variants: { uri: string; score: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]; if (!line.startsWith('#EXT-X-STREAM-INF:')) continue;
    if (/\bAUDIO=/.test(line)) continue;
    const uri = lines[i + 1]; if (!uri || uri.startsWith('#')) throw new TrailerError('Урсгалын хувилбарын холбоос дутуу.');
    const height = Number(/RESOLUTION=\d+x(\d+)/.exec(line)?.[1] || 360);
    const bandwidth = Number(/(?:^|,)BANDWIDTH=(\d+)/.exec(line.slice(18))?.[1] || 1_000_000);
    variants.push({ uri, score: Math.abs(height - 360) + bandwidth / 1e9 });
  }
  if (!variants.length && text.includes('#EXT-X-STREAM-INF:')) throw new TrailerError('Тусдаа дууны урсгалтай энэ видео одоогоор дэмжигдэхгүй.');
  return variants.sort((a, b) => a.score - b.score)[0]?.uri || null;
}

async function bytes(url: URL, limit: number, signal: AbortSignal, referer?: string): Promise<Buffer> {
  const response = await fetch(url, { redirect: 'error', cache: 'no-store', signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]), headers: referer ? { Referer: referer } : {} });
  if (!response.ok) throw new TrailerError('Bunny бичлэгийг уншиж чадсангүй. Холбоос, token болон зөвшөөрөгдсөн домэйны тохиргоог шалгана уу.');
  if (Number(response.headers.get('content-length')) > limit) { await response.body?.cancel(); throw new TrailerError('Киноны хэсгийн хэмжээ хэт том байна.'); }
  if (!response.body) throw new TrailerError('Bunny-ээс хоосон хариу ирлээ.');
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let total = 0;
  try { for (;;) { const { value, done } = await reader.read(); if (done) break; total += value.byteLength; if (total > limit) { await reader.cancel(); throw new TrailerError('Киноны хэсгийн хэмжээ хэт том байна.'); } chunks.push(value); } }
  finally { reader.releaseLock(); }
  return Buffer.concat(chunks, total);
}
async function playlistUrl(source: BunnySource, signal: AbortSignal, referer?: string): Promise<URL> {
  if (!source.libraryId) {
    const url = new URL(source.url); url.pathname = `/${source.videoId}/playlist.m3u8`; url.hash = '';
    return mediaUrl(url.href, url, source.videoId);
  }
  const api = new URL(`https://video.bunnycdn.com/library/${source.libraryId}/videos/${source.videoId}/play`);
  for (const key of ['token', 'expires']) if (source.url.searchParams.has(key)) api.searchParams.set(key, source.url.searchParams.get(key)!);
  let data: { videoPlaylistUrl?: string; enableDRM?: boolean; isPlayable?: boolean; isPlaylistPlayable?: boolean };
  try { data = JSON.parse((await bytes(api, 1_000_000, signal, referer)).toString('utf8')); }
  catch (error) { if (error instanceof TrailerError) throw error; throw new TrailerError('Bunny киноны мэдээлэл уншигдсангүй.'); }
  if (!data || data.enableDRM || data.isPlayable === false || data.isPlaylistPlayable === false || !data.videoPlaylistUrl)
    throw new TrailerError('Энэ киноны урсгал бэлэн биш эсвэл DRM/token хамгаалалттай байна. Bunny тохиргоог шалгана уу.');
  return mediaUrl(data.videoPlaylistUrl, api, source.videoId);
}

/** Read the actual MP4 movie duration; an incomplete encode must never be published. */
export function mp4Duration(buffer: Buffer): number {
  function walk(start: number, end: number): number {
    for (let at = start; at + 8 <= end;) {
      let size = buffer.readUInt32BE(at), header = 8;
      if (size === 1) { if (at + 16 > end) break; const n = buffer.readBigUInt64BE(at + 8); if (n > BigInt(Number.MAX_SAFE_INTEGER)) break; size = Number(n); header = 16; }
      if (size === 0) size = end - at;
      if (size < header || at + size > end) break;
      const kind = buffer.toString('ascii', at + 4, at + 8), p = at + header;
      if (kind === 'moov') { const duration = walk(p, at + size); if (duration > 0) return duration; }
      if (kind === 'mvhd' && p + 20 <= at + size) {
        const version = buffer[p]; if (version === 0) return buffer.readUInt32BE(p + 16) / buffer.readUInt32BE(p + 12);
        if (version === 1 && p + 32 <= at + size) return Number(buffer.readBigUInt64BE(p + 24)) / buffer.readUInt32BE(p + 20);
      }
      at += size;
    }
    return NaN;
  }
  return walk(0, buffer.length);
}
export function ffmpegArguments(input: string, output: string, offset: number): string[] {
  return ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-protocol_whitelist', 'file', '-format_whitelist', 'hls,mpegts,mov',
    '-allowed_extensions', 'ts,m4s,mp4', '-i', input, '-ss', offset.toFixed(6), '-t', String(TRAILER_SECONDS),
    '-map', '0:v:0', '-map', '0:a:0?', '-map_metadata', '-1', '-map_chapters', '-1', '-sn', '-dn',
    '-vf', 'scale=640:360:force_original_aspect_ratio=decrease:force_divisible_by=2,fps=30',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-maxrate', '700k', '-bufsize', '1400k', '-pix_fmt', 'yuv420p', '-threads', '2',
    '-c:a', 'aac', '-b:a', '64k', '-ar', '44100', '-movflags', '+faststart', '-f', 'mp4', output];
}
export async function encodeLocalClip(binary: string, input: string, output: string, offset: number): Promise<Buffer> {
  await new Promise<void>((resolve, reject) => {
    execFile(binary, ffmpegArguments(input, output, offset), { timeout: 45000, killSignal: 'SIGKILL', maxBuffer: 200000 }, error => {
      if (error) reject(new TrailerError('12 секундын бичлэг үүсгэж чадсангүй. Киноны урсгал эсвэл FFmpeg тохиргоог шалгана уу.')); else resolve();
    });
  });
  const result = await readFile(output); const duration = mp4Duration(result);
  if (result.length > MAX_CLIP_BYTES || !Number.isFinite(duration) || Math.abs(duration - TRAILER_SECONDS) > 0.08)
    throw new TrailerError('Бүтэн 12 секундын бичлэг үүссэнгүй. Өөр эхлэх цаг сонгоно уу.');
  return result;
}
export async function createBunnyClip(source: BunnySource, start: number, binary: string, referer?: string): Promise<Buffer> {
  if (!validTrailerStart(start)) throw new TrailerError('Эхлэх цаг буруу байна.');
  const signal = AbortSignal.timeout(45000); const directory = await mkdtemp(join(tmpdir(), 'kino-trailer-'));
  try {
    let url = await playlistUrl(source, signal, referer);
    let text = (await bytes(url, 2_000_000, signal, referer)).toString('utf8');
    const variant = variantUri(text);
    if (variant) { url = mediaUrl(variant, url, source.videoId); text = (await bytes(url, 2_000_000, signal, referer)).toString('utf8'); }
    const selected = selectSegments(parsePlaylist(text), start);
    const local = ['#EXTM3U', '#EXT-X-VERSION:7', '#EXT-X-PLAYLIST-TYPE:VOD', `#EXT-X-TARGETDURATION:${Math.ceil(Math.max(...selected.map(s => s.duration)))}`, '#EXT-X-MEDIA-SEQUENCE:0'];
    let budget = 24_000_000;
    if (selected[0].map) {
      const init = await bytes(mediaUrl(selected[0].map, url, source.videoId), 1_000_000, signal, referer); budget -= init.length;
      await writeFile(join(directory, 'init.mp4'), init); local.push('#EXT-X-MAP:URI="init.mp4"');
    }
    const keys = new Map<string, Buffer>();
    for (let i = 0; i < selected.length; i++) {
      const segment = selected[i];
      let data = await bytes(mediaUrl(segment.uri, url, source.videoId), Math.min(8_000_000, budget), signal, referer); budget -= data.length;
      if (segment.key) {
        const keyUrl = mediaUrl(segment.key.uri, url, source.videoId);
        let key = keys.get(keyUrl.href);
        if (!key) { key = await bytes(keyUrl, 16, signal, referer); if (key.length !== 16) throw new TrailerError('Урсгалын түлхүүрийн формат буруу.'); keys.set(keyUrl.href, key); }
        const iv = segment.key.iv ? Buffer.from(segment.key.iv.slice(2), 'hex') : Buffer.alloc(16);
        if (!segment.key.iv) iv.writeBigUInt64BE(BigInt(segment.sequence), 8);
        const decipher = createDecipheriv('aes-128-cbc', key, iv); data = Buffer.concat([decipher.update(data), decipher.final()]);
      }
      const name = `segment-${i}.${segment.map ? 'm4s' : 'ts'}`;
      await writeFile(join(directory, name), data); local.push(`#EXTINF:${segment.duration},`, name);
    }
    local.push('#EXT-X-ENDLIST'); const input = join(directory, 'clip.m3u8');
    await writeFile(input, local.join('\n') + '\n');
    return await encodeLocalClip(binary, input, join(directory, 'clip.mp4'), start - selected[0].at);
  } catch (error) {
    if (error instanceof TrailerError) throw error;
    throw new TrailerError('Трейлэр үүсгэх холболт тасарсан эсвэл урсгалын формат тохирохгүй байна. Дахин оролдоно уу.');
  } finally { await rm(directory, { recursive: true, force: true }); }
}
