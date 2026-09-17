export type SiteAppearance = { layout: number; tone: number; revision: number };
export const DEFAULT_APPEARANCE: SiteAppearance = {layout: 1, tone: 25, revision: 0};
export const LAYOUTS = [
  {name: "3D Кино", description: "Хүрээ, гялбаа, гүнтэй 3D кино постерын тор"},
  {name: "Премьер", description: "Том баннер, өргөн кино картууд"},
  {name: "Сэтгүүл", description: "Зураг, нэрийг зэрэгцүүлсэн тухтай жагсаалт"},
  {name: "Постер", description: "Постер давамгайлсан кино галерей"},
] as const;

// Only bounded numbers cross the API. No arbitrary CSS, HTML or URLs are stored.
export function validAppearance(value: unknown): value is SiteAppearance {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return Object.keys(v).every(k => ["layout", "tone", "revision"].includes(k))
    && Number.isInteger(v.layout) && Number(v.layout) >= 1 && Number(v.layout) <= 4
    && Number.isInteger(v.tone) && Number(v.tone) >= 0 && Number(v.tone) <= 100
    && Number.isSafeInteger(v.revision) && Number(v.revision) >= 0 && Number(v.revision) < 2147483647;
}
export function readAppearance(value: unknown): SiteAppearance {
  return validAppearance(value) ? {...value} : {...DEFAULT_APPEARANCE};
}
export function sameAppearance(a: SiteAppearance, b: SiteAppearance) {
  return a.layout === b.layout && a.tone === b.tone;
}

const STOPS = [
  {accent: "#c2c6cd", background: "#0c0e12", surface: "#181c22", shade: "#252b33"},
  {accent: "#efb65b", background: "#090d13", surface: "#111822", shade: "#1a2431"},
  {accent: "#f99b91", background: "#190d11", surface: "#29171c", shade: "#3b2329"},
  {accent: "#f4a3ce", background: "#190e1b", surface: "#28182c", shade: "#3a263e"},
  {accent: "#c7b0ff", background: "#101020", surface: "#1b1c31", shade: "#2b2b45"},
] as const;
export const TONE_GRADIENT = "linear-gradient(90deg,#555d67 0%,#b38651 25%,#aa4149 50%,#d875ac 75%,#9575dd 100%)";
function mix(a: string, b: string, t: number) {
  return "#" + [1,3,5].map(i => Math.round(parseInt(a.slice(i,i+2),16)*(1-t)+parseInt(b.slice(i,i+2),16)*t).toString(16).padStart(2,"0")).join("");
}
export function appearanceStyle(appearance: SiteAppearance): Record<`--${string}`, string> {
  const tone = Math.max(0, Math.min(100, appearance.tone));
  const position = tone / 25, index = Math.min(3, Math.floor(position)), progress = position-index;
  const a = STOPS[index], b = STOPS[index+1];
  const accent = mix(a.accent,b.accent,progress), background = mix(a.background,b.background,progress);
  return {
    "--accent": accent, "--accent-ink": "#160f15", "--background": background,
    "--surface": mix(a.surface,b.surface,progress), "--surface-raised": mix(a.shade,b.shade,progress),
    "--foreground": "#f7f5f6", "--muted": "#bab5c0", "--border": mix(background,accent,.22),
    "--accent-soft": accent+"18", "--accent-line": accent+"55", "--header-bg": background+"ee",
    "--poster-start": mix(background,accent,.20), "--poster-end": mix(background,accent,.07),
  };
}
export function toneName(tone: number) {
  return tone < 13 ? "Хар саарал" : tone < 38 ? "Алтан хүрэн" : tone < 63 ? "Улаан хүрэн" : tone < 88 ? "Ягаан" : "Нил ягаан";
}
