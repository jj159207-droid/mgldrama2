import { filmCategory, type CatalogFilm } from "./catalog";
import { ALL_MOVIES_PLAN, ALL_MOVIES_PRICE, safeUrl } from "./domain";

export type FilmDetails = CatalogFilm & {
  title: string;
  description?: string | null;
  img?: string;
  bg?: string;
  preview_url?: string;
  url?: string;
  price?: number;
};

export function relatedFilms<T extends CatalogFilm>(films: T[], selected: CatalogFilm): T[] {
  const seen = new Set<number>();
  return films.filter(film => {
    if (film.id === selected.id || seen.has(film.id) || filmCategory(film) !== filmCategory(selected)) return false;
    seen.add(film.id); return true;
  }).sort((a, b) => (Number(b.views) || 0) - (Number(a.views) || 0) || b.id - a.id).slice(0, 3);
}

export function filmPlans(_film: CatalogFilm) {
  // The entire catalog uses one all-movies bundle. Old purchases remain
  // valid in accessFromPayments for backward compatibility.
  return [{id:ALL_MOVIES_PLAN, hours:72, category:'Бүх кино', price:ALL_MOVIES_PRICE}];
}

export function trailerUrl(film: Pick<FilmDetails, "preview_url" | "url">): string {
  // Only explicitly designated previews are public. Never fall back to the full movie.
  return safeUrl(film.preview_url || film.url?.split("|||")[1] || "");
}

export function getVideoEmbed(value: string): {type:"iframe" | "video" | "youtube"; src:string} {
  const safe = safeUrl(value); if (!safe) return {type:"iframe", src:""};
  const url = new URL(safe); let id:string | null = null;
  if (url.hostname === "youtu.be") id = url.pathname.slice(1);
  if (["youtube.com","www.youtube.com","m.youtube.com","www.youtube-nocookie.com"].includes(url.hostname)) {
    id = url.pathname === "/watch" ? url.searchParams.get("v") : /^\/(?:embed|shorts|live)\/([^/]+)$/.exec(url.pathname)?.[1] || null;
  }
  if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) return {type:"youtube", src:`https://www.youtube-nocookie.com/embed/${id}?playsinline=1`};
  if (/\.(mp4|webm|ogg)$/i.test(url.pathname)) return {type:"video", src:safe};
  const drive = url.hostname === "drive.google.com" ? /^\/file\/d\/([a-zA-Z0-9_-]+)/.exec(url.pathname)?.[1] : null;
  return {type:"iframe", src:drive ? `https://drive.google.com/file/d/${drive}/preview` : safe};
}
