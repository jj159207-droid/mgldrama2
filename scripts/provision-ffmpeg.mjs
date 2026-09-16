// Pin the Linux encoder by archive digest. ffmpeg-static 5.3.0's Linux
// 7.0.2 binary segfaults when opening MPEG-TS (including Bunny HLS).
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { chmod, copyFile, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { execFileSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const binary = require('ffmpeg-static');
const release = 'autobuild-2026-08-31-13-27';
const folder = 'ffmpeg-n8.1.2-50-g1a748fe2cd-linux64-gpl-8.1';
const digest = 'c733b4b2951e5957e15505f788b2c65a7a41b6da4b289e295852cc38079b4d2b';
const archiveUrl = `https://github.com/BtbN/FFmpeg-Builds/releases/download/${release}/${folder}.tar.xz`;
async function fileHash(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}
async function provision() {
  // Other platforms retain ffmpeg-static's platform-specific distribution.
  if (process.platform !== 'linux' || process.arch !== 'x64') return;
  if (!binary) throw new Error('This platform has no FFmpeg binary.');
  if (process.env.FFMPEG_BIN) throw new Error('Unset FFMPEG_BIN when provisioning the pinned production encoder.');
  const marker = `${binary}.kino.json`;
  try {
    const saved = JSON.parse(await readFile(marker, 'utf8'));
    if (saved.archive === digest && saved.binary === await fileHash(binary)) return;
  } catch { /* A clean npm install replaces the old binary. */ }
  const directory = await mkdtemp(join(tmpdir(), 'kino-encoder-'));
  const replacement = `${binary}.kino-new`;
  try {
    const response = await fetch(archiveUrl, { signal: AbortSignal.timeout(150000) });
    if (!response.ok || !response.body) throw new Error(`Pinned FFmpeg download failed (${response.status}).`);
    const archive = join(directory, 'ffmpeg.tar.xz');
    const hash = createHash('sha256'); let size = 0;
    const check = new Transform({ transform(chunk, _encoding, callback) {
      size += chunk.length;
      if (size > 140000000) return callback(new Error('FFmpeg archive exceeds size limit.'));
      hash.update(chunk); callback(null, chunk);
    } });
    await pipeline(Readable.fromWeb(response.body), check, createWriteStream(archive));
    if (hash.digest('hex') !== digest) throw new Error('Pinned FFmpeg archive checksum mismatch.');
    // Extract one known member, never paths supplied by a user or the archive.
    execFileSync('tar', ['-xJf', archive, '--strip-components=2', '-C', directory, `${folder}/bin/ffmpeg`], { timeout: 90000 });
    const extracted = join(directory, 'ffmpeg');
    await chmod(extracted, 0o755);
    const version = execFileSync(extracted, ['-version'], { encoding: 'utf8', timeout: 10000 });
    if (!version.startsWith('ffmpeg version n8.1.2-50-g1a748fe2cd')) throw new Error('Unexpected pinned FFmpeg version.');
    await copyFile(extracted, replacement); await chmod(replacement, 0o755); await rename(replacement, binary);
    await writeFile(marker, JSON.stringify({ archive: digest, binary: await fileHash(binary), release }) + '\n');
    console.log('Pinned Linux FFmpeg 8.1.2 provisioned and checksum verified.');
  } finally { await rm(replacement, { force: true }); await rm(directory, { recursive: true, force: true }); }
}
await provision();
