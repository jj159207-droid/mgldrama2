export const SITE_IDS = ["taza","kino-drama","kinochid","fire"] as const;
export type SiteId = (typeof SITE_IDS)[number];

export const SITES: Record<SiteId,{id:SiteId;name:string;path:string}> = {
  taza:{id:"taza",name:"ТАЗА САЙТ",path:"/"},
  "kino-drama":{id:"kino-drama",name:"КИНО ДРАМА",path:"/kino-drama"},
  kinochid:{id:"kinochid",name:"КИНОЧИД",path:"/kinochid"},
  fire:{id:"fire",name:"FIRE",path:"/fire"},
};

export function isSiteId(value:unknown): value is SiteId {
  return typeof value==="string" && (SITE_IDS as readonly string[]).includes(value);
}

export function siteFromPathname(pathname:string): SiteId {
  const first=pathname.split("/").filter(Boolean)[0] || "";
  if(first==="kino-drama")return "kino-drama";
  if(first==="kinochid")return "kinochid";
  if(first==="fire")return "fire";
  return "taza";
}

export function siteFromHeader(value:unknown): SiteId {
  return isSiteId(value)?value:"taza";
}

export function siteName(id:SiteId) {
  return SITES[id].name;
}

export function sitePath(id:SiteId) {
  return SITES[id].path;
}
