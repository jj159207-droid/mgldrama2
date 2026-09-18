const cleanPublic = (value: string | undefined, fallback: string, max: number) => {
  const text = (value || "").trim().replace(/\s+/g, " ").slice(0, max);
  return text || fallback;
};

export const SITE_NAME = cleanPublic(process.env.NEXT_PUBLIC_SITE_NAME, "ТАЗА САЙТ", 80);
export const SITE_SHORT_NAME = cleanPublic(process.env.NEXT_PUBLIC_SITE_SHORT_NAME, SITE_NAME, 24);
export const SITE_DESCRIPTION = cleanPublic(
  process.env.NEXT_PUBLIC_SITE_DESCRIPTION,
  "Монгол, гадаад, хятад кино үзэх сайт. Нэг дор бүгд.",
  180,
);
