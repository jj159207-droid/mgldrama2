import { filmCategory, type CatalogFilm } from "./catalog";
import { plans, safeUrl } from "./domain";

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

export function filmPlans(film: CatalogFilm) {
  const category = filmCategory(film);
  const key = ({"Эротик":"erotic", "Хятад":"hyatad", "Гадаад":"gadaad", "Орос":"oros"} as Record<string,string>)[category];
  if (!key) return [];
  return [{id:`${key}_3day`, hours:72}].map(plan => ({...plan, category, price:plans[plan.id]}));
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
