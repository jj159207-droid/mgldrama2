import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { signR2PlaybackUrl, r2MovieObjectKey } from './r2';
import { MAX_CLIP_BYTES, mp4Duration, TrailerError } from './trailer-media';
import { TRAILER_SECONDS, validTrailerStart } from './trailer-spec';

/**
 * Extract only the administrator-selected 12 seconds of a private R2 MP4.
 * The source stays private and is accessed by FFmpeg through a short-lived
 * server-side signed GET. The browser only ever receives the resulting clip.
 * Do NOT accept arbitrary remote URLs: that would be an SSRF risk.
 */
export async function createPrivateR2Trailer(reference: string, start: number, binary: string): Promise<Buffer> {
  const key = r2MovieObjectKey(reference);
  if (!key || !/\.mp4$/i.test(key))
    throw new TrailerError('R2-ийн хувийн MP4 киноны зам оруулна уу (r2://taza-movies/films/...mp4).');
  if (!validTrailerStart(start)) throw new TrailerError('Эхлэх цаг буруу байна.');
  if (!binary) throw new TrailerError('FFmpeg тохиргоо дутуу байна.');
  const directory = await mkdtemp(join(tmpdir(), 'kino-r2-trailer-'));
  try {
    const output = join(directory, 'trailer.mp4');
    const signed = signR2PlaybackUrl(reference);
    // Seek before -i to use the HTTP range support provided by R2, avoiding
    // reading the whole movie into the Netlify function.
    const args = [
      '-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
      '-protocol_whitelist', 'https,tls,tcp',
      '-ss', String(start), '-i', signed,
      '-t', String(TRAILER_SECONDS),
      '-map', '0:v:0', '-map', '0:a:0?', '-map_metadata', '-1',
      '-map_chapters', '-1', '-sn', '-dn',
      '-vf', 'scale=640:360:force_original_aspect_ratio=decrease:force_divisible_by=2,fps=30',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26',
      '-maxrate', '700k', '-bufsize', '1400k', '-pix_fmt', 'yuv420p', '-threads', '2',
      '-c:a', 'aac', '-b:a', '64k', '-ar', '44100',
      '-movflags', '+faststart', '-f', 'mp4', output,
    ];
    await new Promise<void>((resolve, reject) => {
      execFile(binary, args, { timeout: 65000, killSignal: 'SIGKILL', maxBuffer: 120000 }, error =>
        error ? reject(new TrailerError('R2 бичлэгээс трейлер үүсгэж чадсангүй. Файл, сонгосон цаг эсвэл FFmpeg холболтыг шалгана уу.')) : resolve());
    });
    const result = await readFile(output);
    const duration = mp4Duration(result);
    if (result.length > MAX_CLIP_BYTES || !Number.isFinite(duration) || Math.abs(duration - TRAILER_SECONDS) > 0.12)
      throw new TrailerError('Сонгосон цагаас бүтэн 12 секундын трейлер үүссэнгүй. Эрт эхлэх цэг сонгоно уу.');
    return result;
  } catch (error) {
    if (error instanceof TrailerError) throw error;
    throw new TrailerError('Cloudflare R2 киноны бичлэгийг уншиж чадсангүй. Дахин оролдоно уу.');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
