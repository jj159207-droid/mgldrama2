import { randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { isRow } from "@/lib/domain";
import { ApiError, bodyJson, canAdminSite, db, fail, json, originCheck, requestSite, session } from "@/lib/server";

export const runtime = "nodejs";

const VISITOR_COOKIE = "taza_visitor_v1";
const EVENTS = new Set(["visit","film_open","watch_click","payment_open","play_start","bank_account_copy","ref_code_copy","paywall_view","entry_payment_success"]);
const FILM_EVENTS = new Set(["film_open","watch_click","payment_open","play_start"]);
const SOURCES = new Set(["facebook","direct","other"]);

export async function POST(req: NextRequest) {
  try {
    originCheck(req);
    const site=requestSite(req),body = await bodyJson(req,4096);
    if(body.action==="reset"){
      const s=await session(req);
      if(!canAdminSite(s,site))throw new ApiError(403,"Энэ сайтын админы эрх шаардлагатай.");
      const [reset]=await db("rpc/kino_analytics_reset_site","POST",{p_site:site});
      return json({ok:true,resetAt:reset?.reset_at||new Date().toISOString(),site});
    }
    const eventType = String(body.event || "");
    if(!EVENTS.has(eventType)) throw new ApiError(400,"Статистикийн үйлдэл буруу.");

    const rawFilm = body.film_id;
    const filmId = rawFilm === undefined || rawFilm === null ? null : Number(rawFilm);
    if(FILM_EVENTS.has(eventType) && (!Number.isSafeInteger(filmId) || Number(filmId) <= 0)) {
      throw new ApiError(400,"Киноны ID буруу.");
    }

    const source = SOURCES.has(String(body.source || "")) ? String(body.source) : "direct";
    const cookie = req.cookies.get(VISITOR_COOKIE)?.value || "";
    const hasVisitor = /^[a-f0-9]{32}$/.test(cookie);
    const visitorKey = hasVisitor ? cookie : randomBytes(16).toString("hex");

    await db("site_events","POST",{
      visitor_key:visitorKey,
      event_type:eventType,
      film_id:FILM_EVENTS.has(eventType) ? filmId : null,
      source,
      site_id:site,
    });

    const res = json({ok:true});
    if(!hasVisitor) {
      res.cookies.set(VISITOR_COOKIE,visitorKey,{
        httpOnly:true,
        secure:process.env.NODE_ENV === "production",
        sameSite:"lax",
        path:"/",
        maxAge:365*24*60*60,
      });
    }
    return res;
  } catch(error) {
    return fail(error);
  }
}

export async function GET(req: NextRequest) {
  try {
    const site=requestSite(req),s = await session(req);
    if(!canAdminSite(s,site)) throw new ApiError(403,"Энэ сайтын админы эрх шаардлагатай.");
    const daysRaw = Number(new URL(req.url).searchParams.get("days") || 30);
    const days = Number.isSafeInteger(daysRaw) ? Math.min(365,Math.max(1,daysRaw)) : 30;
    const [row] = await db("rpc/kino_analytics_summary_site","POST",{p_site:site,p_days:days});
    const summary=isRow(row?.summary)?row.summary:{days,today:{},period:{},topFilms:[],daily:[],site};
    return json(summary);
  } catch(error) {
    return fail(error);
  }
}
