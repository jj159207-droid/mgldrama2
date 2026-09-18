import { randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { ApiError, bodyJson, db, fail, json, originCheck, session } from "@/lib/server";

export const runtime = "nodejs";

const VISITOR_COOKIE = "taza_visitor_v1";
const EVENTS = new Set(["visit","film_open","watch_click","play_start"]);
const SOURCES = new Set(["facebook","direct","other"]);

export async function POST(req: NextRequest) {
  try {
    originCheck(req);
    const body = await bodyJson(req,4096);
    const eventType = String(body.event || "");
    if(!EVENTS.has(eventType)) throw new ApiError(400,"Статистикийн үйлдэл буруу.");

    const rawFilm = body.film_id;
    const filmId = rawFilm === undefined || rawFilm === null ? null : Number(rawFilm);
    if(eventType !== "visit" && (!Number.isSafeInteger(filmId) || Number(filmId) <= 0)) {
      throw new ApiError(400,"Киноны ID буруу.");
    }

    const source = SOURCES.has(String(body.source || "")) ? String(body.source) : "direct";
    const cookie = req.cookies.get(VISITOR_COOKIE)?.value || "";
    const hasVisitor = /^[a-f0-9]{32}$/.test(cookie);
    const visitorKey = hasVisitor ? cookie : randomBytes(16).toString("hex");

    await db("site_events","POST",{
      visitor_key:visitorKey,
      event_type:eventType,
      film_id:eventType === "visit" ? null : filmId,
      source,
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
    const s = await session(req);
    if(!s?.admin) throw new ApiError(403,"Админы эрх шаардлагатай.");
    const daysRaw = Number(new URL(req.url).searchParams.get("days") || 30);
    const days = Number.isSafeInteger(daysRaw) ? Math.min(365,Math.max(1,daysRaw)) : 30;
    const [row] = await db("rpc/kino_analytics_summary","POST",{p_days:days});
    return json(row?.summary || {days,today:{},period:{},topFilms:[]});
  } catch(error) {
    return fail(error);
  }
}
