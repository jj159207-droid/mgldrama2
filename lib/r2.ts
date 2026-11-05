import { createHash, createHmac } from 'node:crypto';
import { ApiError } from './server';

/**
 * Film source stored in films.url. Never put a public R2 URL, an S3 credential,
 * or a presigned URL into the database. Only the full video (first ||| segment)
 * may use this reference; public previews remain ordinary HTTPS URLs.
 */
const BUCKET = 'taza-movies';
const PREFIX = `r2://${BUCKET}/`;
const EXPIRY_SECONDS = 4 * 60 * 60;

export function r2MovieObjectKey(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith(PREFIX)) return null;
  const key = value.slice(PREFIX.length);
  if (key.length < 5 || key.length > 512 || !/^[A-Za-z0-9][A-Za-z0-9._/-]*\.(mp4|webm)$/i.test(key)) return null;
  const pieces = key.split('/');
  if (pieces.some(piece => !piece || piece === '.' || piece === '..')) return null;
  return key;
}

export function isR2MovieReference(value: unknown): value is string {
  return r2MovieObjectKey(value) !== null;
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const hmac = (key: Buffer | string, value: string) => createHmac('sha256', key).update(value).digest();

/**
 * Sign only GET on one private object, AFTER /api/playback checks sessions
 * and payment entitlement. URL is a bearer token and expires after 4 hours
 * (enough for ordinary long-form MP4 playback; never store/reuse it).
 *
 * Signature V4: https://developers.cloudflare.com/r2/api/s3/presigned-urls/
 */
export function signR2PlaybackUrl(reference: string, at = new Date()): string {
  const key = r2MovieObjectKey(reference);
  if (!key) throw new ApiError(400, 'R2 киноны файлын зам буруу байна.', 'R2_INVALID_REFERENCE');
  const accountId = process.env.R2_ACCOUNT_ID?.trim() || '';
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim() || '';
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim() || '';
  if (!/^[a-f0-9]{32}$/i.test(accountId) || !accessKeyId || !secretAccessKey)
    throw new ApiError(503, 'R2 серверийн нууц холболт тохируулагдаагүй байна.', 'CONFIG_REQUIRED');
  if (!Number.isFinite(at.getTime())) throw new ApiError(500, 'Серверийн цаг буруу байна.');

  const host = `${accountId.toLowerCase()}.r2.cloudflarestorage.com`;
  const uri = `/${BUCKET}/${key.split('/').map(encodeURIComponent).join('/')}`;
  const timestamp = at.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const day = timestamp.slice(0, 8);
  const scope = `${day}/auto/s3/aws4_request`;
  const pairs: Array<[string, string]> = [
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Credential', `${accessKeyId}/${scope}`],
    ['X-Amz-Date', timestamp],
    ['X-Amz-Expires', String(EXPIRY_SECONDS)],
    ['X-Amz-SignedHeaders', 'host'],
  ];
  const query = pairs.map(([name, value]) =>
    `${encodeURIComponent(name)}=${encodeURIComponent(value)}`).sort().join('&');
  const canonical = `GET\n${uri}\n${query}\nhost:${host}\n\nhost\nUNSIGNED-PAYLOAD`;
  const toSign = `AWS4-HMAC-SHA256\n${timestamp}\n${scope}\n${sha256(canonical)}`;
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, day), 'auto'), 's3'), 'aws4_request');
  const signature = createHmac('sha256', signingKey).update(toSign).digest('hex');
  return `https://${host}${uri}?${query}&X-Amz-Signature=${signature}`;
}
