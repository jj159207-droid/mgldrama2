import { safeUrl } from "./domain";

export const CATEGORIES = ["Бүгд", "Гадаад", "Хятад", "Орос", "Эротик"] as const;
export type Category = typeof CATEGORIES[number];
export type CatalogFilm = {
  id: number;
  title?: string | null;
  badge?: string | null;
  img?: string | null;
  preview_url?: string | null;
  views?: number | string | null;
  created_at?: string | null;
  free?: boolean;
  locked?: boolean;
};
export type CatalogState = {
  query: string;
  category: Category;
  access: "all" | "available" | "free";
  sort: "featured" | "newest" | "popular" | "title";
  visibleCount: number;
};
export const INITIAL_CATALOG: CatalogState = {
  query: "", category: "Бүгд", access: "all", sort: "newest", visibleCount: 24,
};

// Match words regardless of case, spacing, or punctuation; keep Ө/Ү distinct.
export function normalizeSearch(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("mn")
    .replace(/[\p{P}\p{S}]+/gu, " ").replace(/\s+/g, " ").trim();
}

export function filmCategory(film: CatalogFilm): string {
  return film.badge?.split("|")[1] || "Эротик";
}

/** Prioritize real poster+trailer, then posters, then trailer-only previews, then blanks. */
export function mediaRank(film: Pick<CatalogFilm, "img" | "preview_url">): number {
  const poster = !!safeUrl(film.img, true);
  const trailer = !!safeUrl(film.preview_url);
  if (poster && trailer) return 0;
  if (poster) return 1;
  if (trailer) return 2;
  return 3;
}

export function filterCatalog<T extends CatalogFilm>(films: T[], state: CatalogState): T[] {
  const words = normalizeSearch(state.query).split(" ").filter(Boolean);
  const filtered = films.filter(film => {
    if (state.category !== "Бүгд" && filmCategory(film) !== state.category) return false;
    if (state.access === "free" && !film.free) return false;
    if (state.access === "available" && !film.free && film.locked !== false) return false;
    const title = normalizeSearch(film.title || "");
    return words.every(word => title.includes(word));
  });
  const newest = (a: T, b: T) => b.id - a.id;
  return filtered.sort((a, b) => {
    if (state.sort === "featured") return mediaRank(a) - mediaRank(b) || newest(a, b);
    if (state.sort === "popular") return (Number(b.views) || 0) - (Number(a.views) || 0) || newest(a, b);
    if (state.sort === "title") return (a.title || "").localeCompare(b.title || "", "mn", {numeric: true}) || newest(a, b);
    const dateA = Date.parse(a.created_at || ""), dateB = Date.parse(b.created_at || "");
    return (Number.isFinite(dateB) ? dateB : 0) - (Number.isFinite(dateA) ? dateA : 0) || newest(a, b);
  });
}
