export interface ChatMessage {
  id: number; sender: 'user' | 'admin'; message: string; client_id: string;
  created_at: string; read_at: string | null; image_url: string | null;
  grant_payment_id?: number | null;
}

export const CHAT_WELCOME = 'Таны кино нээгдээгүй эсвэл гүйлгээний утгаа буруу бичсэн бол мөнгө шилжүүлсэн баримтын зургаа энд илгээнэ үү. Киноны нэр эсвэл авсан багцаа (3 хоног / 1 сар, ангилал) тодорхой бичээрэй. Админ шалгаад энд хариулна.';
export interface ChatThread {
  user_id: number; phone: string; label: string | null; message: string;
  has_image: boolean; sender: 'user' | 'admin'; updated_at: string; unread: number;
}

export async function prepareChatImage(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type))
    throw new Error('JPEG, PNG, WebP эсвэл GIF зураг сонгоно уу.');
  if (file.size > 12000000) throw new Error('12 MB хүртэл зураг сонгоно уу.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 24000000)
      throw new Error('Зураг хэт өндөр нягтралтай байна. Багасгаад илгээнэ үү.');
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Зургийг бэлдэж чадсангүй.');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const result = canvas.toDataURL('image/webp', 0.8);
    if (result.length > 2800000) throw new Error('Зураг хэт том байна. Багасгаад илгээнэ үү.');
    return result;
  } finally { URL.revokeObjectURL(url); }
}
