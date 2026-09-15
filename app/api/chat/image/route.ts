import { NextRequest } from 'next/server';
import { db, fail, ApiError } from '@/lib/server';
import { chatId, chatSession } from '@/lib/chat';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const s = await chatSession(req), id = chatId(req.nextUrl.searchParams.get('id'));
    const [msg] = await db(`support_messages?id=eq.${id}${s.admin ? '' : `&user_id=eq.${s.userId}`}&select=id,has_image&limit=1`);
    if (!msg?.has_image) throw new ApiError(404, 'Зураг олдсонгүй эсвэл хадгалах хугацаа дууссан байна.');
    const [image] = await db(`support_images?message_id=eq.${id}&select=data&limit=1`);
    if (typeof image?.data !== 'string' || !/^\\x[0-9a-f]+$/i.test(image.data)) throw new ApiError(404, 'Зураг олдсонгүй.');
    return new Response(new Uint8Array(Buffer.from(image.data.slice(2), 'hex')), {headers: {
      'Content-Type': 'image/webp', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': `inline; filename="chat-${id}.webp"`, 'Cross-Origin-Resource-Policy': 'same-origin',
    }});
  } catch (error) { return fail(error); }
}
