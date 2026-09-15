import sharp from 'sharp';
import { NextRequest } from 'next/server';
import { ApiError, session, type Session } from './server';
import type { Row } from './domain';

export const CHAT_INPUT_LIMIT = 3000000;
export const CHAT_IMAGE_LIMIT = 350000;
export const CHAT_SELECT = 'id,user_id,sender,message,has_image,client_id,created_at,read_at';

export function chatId(value: unknown): number {
  if (!/^[1-9]\d{0,14}$/.test(String(value))) throw new ApiError(400, 'Харилцан ярианы дугаар буруу.');
  const id = Number(value);
  if (!Number.isSafeInteger(id)) throw new ApiError(400, 'Дугаар буруу.');
  return id;
}

export async function chatSession(req: NextRequest): Promise<Session> {
  const s = await session(req);
  if (!s || (!s.admin && !s.userId)) throw new ApiError(401, 'Чатлахын тулд нэвтэрнэ үү.');
  return s;
}

export function chatOwner(s: Session, requested: unknown): number {
  if (s.admin) return chatId(requested);
  if (requested !== undefined && requested !== null && chatId(requested) !== s.userId)
    throw new ApiError(403, 'Энэ харилцан яриаг нээх эрхгүй.');
  return s.userId!;
}

export function chatMessage(row: Row) {
  return {
    id: row.id, sender: row.sender, message: row.message, client_id: row.client_id,
    created_at: row.created_at, read_at: row.read_at,
    image_url: row.has_image ? `/api/chat/image?id=${row.id}` : null,
  };
}

export async function chatImage(value: unknown): Promise<string | null> {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.length > 2800000) throw new ApiError(413, 'Зураг хэт том байна.');
  const match = /^data:image\/(?:jpeg|png|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) throw new ApiError(400, 'JPEG, PNG, WebP эсвэл GIF зураг сонгоно уу.');
  const input = Buffer.from(match[1], 'base64');
  if (input.toString('base64') !== match[1]) throw new ApiError(400, 'Зургийн өгөгдөл буруу.');
  try {
    const options = {limitInputPixels: 24000000, animated: false, failOn: 'warning' as const};
    const meta = await sharp(input, options).metadata();
    if (!['jpeg', 'png', 'webp', 'gif'].includes(meta.format || '')) throw new Error('Unsupported image');
    // Re-encoding strips EXIF/location and active content. Bound the bytes kept
    // in the private attachment table; cascading retention leaves no orphans.
    for (const size of [1600, 1200, 900]) {
      const output = await sharp(input, options).rotate().resize(size, size, {fit: 'inside', withoutEnlargement: true})
        .flatten({background: '#fff'}).webp({quality: 78}).toBuffer();
      if (output.length <= CHAT_IMAGE_LIMIT) return output.toString('base64');
    }
    throw new ApiError(413, 'Зургийг багасгаж чадсангүй. Өөр зураг сонгоно уу.');
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, 'Зургийг уншиж чадсангүй. Өөр зураг сонгоно уу.');
  }
}
