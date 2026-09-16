import {NextRequest} from "next/server";
import {ApiError, bodyJson, db, fail, json, originCheck, session} from "@/lib/server";
import {validAppearance} from "@/lib/appearance";
export const runtime = "nodejs";
const SELECT = "layout,tone,revision";
export async function GET() {
  try {
    const [appearance] = await db(`site_appearance?id=eq.1&select=${SELECT}`);
    if (!validAppearance(appearance)) throw new ApiError(503,"Загварын тохиргоог ачаалж чадсангүй.");
    return json({appearance});
  } catch (error) { return fail(error); }
}
export async function PUT(req: NextRequest) {
  try {
    originCheck(req);
    if (!(await session(req))?.admin) throw new ApiError(403,"Админы эрх шаардлагатай.");
    const input = await bodyJson(req, 2048);
    if (!validAppearance(input)) throw new ApiError(400,"Загвар 1–4, өнгө 0–100 хооронд байх ёстой.");
    const [appearance] = await db(`site_appearance?id=eq.1&revision=eq.${input.revision}&select=${SELECT}`,"PATCH",{
      layout:input.layout,tone:input.tone,revision:input.revision+1,
    });
    if (!appearance) throw new ApiError(409,"Загварыг өөр цонхноос өөрчилсөн байна. Шинэ тохиргоог ачаалаад дахин сонгоно уу.","APPEARANCE_CONFLICT");
    if (!validAppearance(appearance)) throw new ApiError(502,"Хадгалсан загварыг баталгаажуулж чадсангүй.");
    return json({appearance});
  } catch (error) { return fail(error); }
}
