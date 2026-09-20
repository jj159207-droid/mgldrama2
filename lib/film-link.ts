import { siteFromPathname, sitePath } from "./site";
export type FilmDestination = {kind: "none"} | {kind: "invalid"} | {kind: "film"; id: number};

export function readFilmDestination(search: string): FilmDestination {
  const values = new URLSearchParams(search).getAll("film");
  if (!values.length) return {kind: "none"};
  if (values.length !== 1 || !/^[1-9]\d*$/.test(values[0])) return {kind: "invalid"};
  const id = Number(values[0]);
  return Number.isSafeInteger(id) ? {kind: "film", id} : {kind: "invalid"};
}

// An ad carries only the public movie ID, never a playback URL or a session.
export function filmShareUrl(siteUrl: string, id: number): string {
  const site = new URL(siteUrl);
  if (!Number.isSafeInteger(id) || id <= 0 || !["https:", "http:"].includes(site.protocol)) {
    throw new Error("Киноны холбоос үүсгэж чадсангүй.");
  }
  const currentSite=siteFromPathname(site.pathname);
  const base=sitePath(currentSite);
  return currentSite==="taza" ? `${site.origin}/?film=${id}` : `${site.origin}${base}/${id}`;
}

// Keep attribution parameters in the visitor's address while changing films.
export function filmNavigationUrl(currentUrl: string, id: number | null): string {
  const url = new URL(currentUrl);
  url.searchParams.delete("film");
  if (id !== null) {
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Киноны дугаар буруу.");
    url.searchParams.set("film", String(id));
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

// Give a newly opened Facebook/movie link a real home entry directly behind it.
// The marker survives reloads so refresh and Strict Mode cannot grow the stack.
export function prepareFilmHistory(history: History, currentUrl: string): void {
  const url = new URL(currentUrl);
  if (readFilmDestination(url.search).kind === "none" || history.state?.tazaFilmHome) return;
  history.replaceState({page: "home"}, "", filmNavigationUrl(currentUrl, null));
  history.pushState({page: "film", tazaFilmHome: true}, "", `${url.pathname}${url.search}${url.hash}`);
}
