import {NextRequest} from "next/server";
import {ApiError, bodyJson, canAdminSite, db, fail, json, originCheck, requestSite, session} from "@/lib/server";
import {validAppearance} from "@/lib/appearance";
export const runtime = "nodejs";
const SELECT = "layout,tone,revision";
export async function GET(req:NextRequest) {
  try {
    const site=requestSite(req);
    const [appearance] = await db(`site_appearance?site_id=eq.${site}&select=${SELECT}`);
    if (!validAppearance(appearance)) throw new ApiError(503,"Загварын тохиргоог ачаалж чадсангүй.");
    return json({appearance});
  } catch (error) { return fail(error); }
}
export async function PUT(req: NextRequest) {
  try {
    originCheck(req);
    const site=requestSite(req),s=await session(req);
    if (!canAdminSite(s,site)) throw new ApiError(403,"Энэ сайтын админы эрх шаардлагатай.");
    const input = await bodyJson(req, 2048);
    if (!validAppearance(input)) throw new ApiError(400,"Загвар 1–4, өнгө 0–100 хооронд байх ёстой.");
    const [appearance] = await db(`site_appearance?site_id=eq.${site}&revision=eq.${input.revision}&select=${SELECT}`,"PATCH",{
      layout:input.layout,tone:input.tone,revision:input.revision+1,
    });
    if (!appearance) throw new ApiError(409,"Загварыг өөр цонхноос өөрчилсөн байна. Шинэ тохиргоог ачаалаад дахин сонгоно уу.","APPEARANCE_CONFLICT");
    if (!validAppearance(appearance)) throw new ApiError(502,"Хадгалсан загварыг баталгаажуулж чадсангүй.");
    return json({appearance});
  } catch (error) { return fail(error); }
}
