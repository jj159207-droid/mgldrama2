import { NextRequest } from 'next/server';
import { ApiError, bodyJson, db, fail, json, originCheck } from '@/lib/server';
import { chatOwner, chatSession } from '@/lib/chat';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    originCheck(req);
    const s = await chatSession(req), b = await bodyJson(req, 1000);
    if (Object.keys(b).some(k => !['user','active','typing'].includes(k)) || typeof b.active !== 'boolean' || typeof b.typing !== 'boolean') throw new ApiError(400, 'Чатны төлөв буруу.');
    await db('rpc/kino_chat_activity', 'POST', {p_user: chatOwner(s,b.user), p_admin: s.admin, p_active: b.active, p_typing: b.typing});
    return json({ok:true});
  } catch (error) {return fail(error);}
}
