import { safeUrl } from './domain';

export const OFFLINE_MOVIE_CACHE = 'taza-offline-movies-v1';

export type OfflineMovieMeta = {
  filmId:number;
  title:string;
  expiresAt:number;
  storedAt:number;
  size:number;
};

export const offlineMovieKey = (id:number) => `/__taza_offline__/movie/${id}`;
export const offlineMetaKey = (id:number) => `/__taza_offline__/meta/${id}`;

/**
 * Only approved full-playback URLs may be passed here (never public catalog
 * records). Offline copies require an actual MP4: Bunny embed pages and HLS
 * manifests are not downloadable movies.
 *
 * Bunny MP4 Fallback must have been enabled when that movie was encoded.
 * We cannot make unavailable MP4s work just by converting an iframe URL.
 */
export function offlineMp4Candidates(raw:string):string[] {
  const safe=safeUrl(raw.split('|||')[0]);if(!safe)return [];
  const url=new URL(safe);
  if (/\.mp4$/i.test(url.pathname))return [safe];
  // Signed Bunny player / CDN URLs cannot safely be converted to unsigned MP4s.
  if(url.search || url.hash)return [];
  let hostname:string,videoId:string;
  if(['player.mediadelivery.net','iframe.mediadelivery.net'].includes(url.hostname)){
    const match=/^\/(?:embed|play)\/(\d{3,12})\/([a-f0-9-]{32,36})\/?$/i.exec(url.pathname);
    if(!match)return [];
    hostname=`vz-${match[1]}.b-cdn.net`;videoId=match[2];
  }else{
    const match=/^\/([a-f0-9-]{32,36})\/playlist\.m3u8$/i.exec(url.pathname);
    if(!/^(?:vz-\d+\.)?[-a-z0-9]+\.b-cdn\.net$/.test(url.hostname)||!match)return [];
    hostname=url.hostname;videoId=match[1];
  }
  // 480p first to conserve mobile storage; fall back to lower qualities.
  return [480,360,720].map(height=>`https://${hostname}/${videoId}/play_${height}p.mp4`);
}

export function offlineExpiry(access:Record<string,number>, filmId:number, badge?:string):number {
  const category=badge?.split('|')[1]||'';
  const catKey=({'Эротик':'cat_erotic','Гадаад':'cat_gadaad','Хятад':'cat_hyatad','Орос':'cat_oros'} as Record<string,string>)[category];
  const expiry=Math.max(Number(access.monthly||0),Number(access[`film_${filmId}`]||0),catKey?Number(access[catKey]||0):0);
  return Number.isFinite(expiry) && expiry>Date.now()?expiry:0;
}
