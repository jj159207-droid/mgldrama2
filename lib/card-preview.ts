import { getVideoEmbed, trailerUrl, type FilmDetails } from "./film-details";

/** Only a deliberately provided trailer, never the locked full movie URL. */
export function cardPreviewSource(film: Pick<FilmDetails, "preview_url" | "url">): string {
  const candidate = trailerUrl(film);
  if (!candidate) return "";
  const embed = getVideoEmbed(candidate);
  return embed.type === "video" ? embed.src : "";
}
