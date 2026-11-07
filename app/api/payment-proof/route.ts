import { NextRequest } from 'next/server';
import { chatImage, chatRequestId } from '@/lib/chat';
import { ApiError, bodyJson, db, fail, json, originCheck, requestSite, session } from '@/lib/server';

export const runtime = 'nodejs';

// A screenshot is evidence for an administrator, never proof of bank settlement.
// Payment entitlement is granted only by authenticated bank SMS or admin review.
export async function POST(req: NextRequest) {
  try {
    originCheck(req);
    if (requestSite(req) !== 'taza') throw new ApiError(404, 'Энэ үйлчилгээ зөвхөн TAZA SITE-д нээлттэй.');
    const s = await session(req);
    if (!s?.userId || s.admin) throw new ApiError(401, 'Баримт илгээхийн тулд киноны хэрэглэгчээр нэвтэрнэ үү.');

    const b = await bodyJson(req, 3000000);
    if (Object.keys(b).some(key => !['ref_code', 'client_id', 'image'].includes(key)))
      throw new ApiError(400, 'Баримтын мэдээллийн формат буруу.');
    const ref = String(b.ref_code || '');
    if (!/^\d{6}$/.test(ref)) throw new ApiError(400, 'Гүйлгээний 6 оронтой код буруу.');
    const client = chatRequestId(b.client_id);

    const [order] = await db(
      `pending_payments?site_id=eq.taza&user_id=eq.${s.userId}&ref_code=eq.${ref}&select=id,ref_code,plan,amount,status,film_id,created_at&limit=1`
    );
    if (!order || order.plan !== 'single' || Number(order.amount) !== 2000)
      throw new ApiError(404, 'Энэ кодтой 2,000₮-ийн нэг киноны захиалга олдсонгүй.');
    if (order.status === 'confirmed') return json({ok: true, already_paid: true});
    if (order.status !== 'pending') throw new ApiError(409, 'Захиалгын хугацаа дууссан эсвэл цуцлагдсан. Админтай холбогдоно уу.');
    const age = Date.now() - Date.parse(String(order.created_at || ''));
    if (!Number.isFinite(age) || age < -120000 || age > 24 * 3600000)
      throw new ApiError(409, 'Гүйлгээний кодын хугацаа дууссан. Админтай холбогдоно уу.');

    const filmId = Number(order.film_id);
    if (!Number.isSafeInteger(filmId) || filmId <= 0)
      throw new ApiError(400, 'Киноны мэдээлэл буруу.');
    const [film] = await db(`films?site_id=eq.taza&id=eq.${filmId}&select=id,title&limit=1`);
    if (!film) throw new ApiError(404, 'Сонгосон кино олдсонгүй.');

    // Existing private support-chat images are re-encoded and stripped of metadata.
    const image = await chatImage(b.image);
    if (!image) throw new ApiError(400, 'Гүйлгээ амжилттай гэсэн screenshot оруулна уу.');

    const title = String(film.title || 'Сонгосон кино').replace(/\s+/g, ' ').slice(0, 140);
    const message = `🧾 1 киноны төлбөрийн баримт · БАНКААР ШАЛГАХ\nКино: ${title}\nГүйлгээний код: ${ref}\nДүн: 2,000₮\nБаримтын зураг хавсаргав. Зураг дангаараа төлбөр баталгаажуулахгүй. Банкны бодит орлого, дүн, код таарсны дараа эрх нээнэ үү.`;
    const rows = await db('rpc/kino_chat_send_site', 'POST', {
      p_site: 'taza', p_user: s.userId, p_sender: 'user',
      p_message: message, p_image: image, p_client: client,
    });
    return json({ok: true, submitted: true, chat_message_id: rows[0]?.id || null});
  } catch (error) {
    if (error instanceof ApiError && error.code === 'P0429')
      return json({message: 'Хэт олон удаа илгээсэн байна. Нэг минутын дараа дахин оролдоно уу.'}, 429);
    return fail(error);
  }
}
