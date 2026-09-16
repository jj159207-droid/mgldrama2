/** Shared editor metadata. The full movie URL is never used as a public trailer. */
export const TRAILER_SECONDS = 12;
export const MAX_TRAILER_START = 359999;
export function validTrailerStart(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= MAX_TRAILER_START;
}
export function timeParts(value: number): [string, string, string] {
  const seconds = validTrailerStart(value) ? value : 0;
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(n => String(n).padStart(2, '0')) as [string, string, string];
}
export function parseTimeParts(hours: string, minutes: string, seconds: string): number | null {
  if (![hours, minutes, seconds].every(v => /^\d{1,2}$/.test(v))) return null;
  if (Number(minutes) > 59 || Number(seconds) > 59) return null;
  const result = Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
  return validTrailerStart(result) ? result : null;
}
export function formatTrailerTime(seconds: number): string {
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(n => String(n).padStart(2, '0')).join(':');
}
export function generatedTrailerStart(value: string): number | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !/\/storage\/v1\/object\/public\/kino-trailers\/v1\/[a-f0-9]{64}\.mp4$/.test(url.pathname)) return null;
    const params = new URLSearchParams(url.hash.slice(1));
    if (params.get('taza-trailer') !== '1' || !/^\d+$/.test(params.get('start') || '')) return null;
    const seconds = Number(params.get('start'));
    return validTrailerStart(seconds) ? seconds : null;
  } catch { return null; }
}
export function isBunnySource(value: string): boolean {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
    return ['iframe.mediadelivery.net', 'player.mediadelivery.net', 'video.bunnycdn.com'].includes(url.hostname)
      || /^[a-z0-9-]+\.b-cdn\.net$/.test(url.hostname);
  } catch { return false; }
}
