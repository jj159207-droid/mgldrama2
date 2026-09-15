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
  return `${site.origin}/?film=${id}`;
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
