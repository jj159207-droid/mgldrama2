import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const text = body.text || "";

  const match = text.match(/KNM?\d{4,8}/i);
  if (!match) {
    return NextResponse.json({ ok: false, msg: "KN код олдсонгүй" });
  }

  const ref = match[0].toUpperCase();

  // SMS-ээс зөвхөн ORLOGO дүнг авна — ULDEGDEL-г авахгүй
  // Жишээ: "ORLOGO:12,500.00MNT hiigdej ULDEGDEL:88,420.00MNT"
  let paidAmount = 0;
  const orlogoMatch = text.match(/ORLOGO:([\d,]+)\.?\d*MNT/i) || text.match(/ORLOGO[:\s]+([\d,]+)/i);
  if (orlogoMatch) {
    paidAmount = parseInt(orlogoMatch[1].replace(/,/g, ""));
  }

  // Pending төлбөр татах
  const checkRes = await fetch(
    `${SUPABASE_URL}/rest/v1/pending_payments?ref_code=eq.${ref}&status=eq.pending&select=*`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const pending = await checkRes.json();

  if (!Array.isArray(pending) || pending.length === 0) {
    return NextResponse.json({ ok: false, msg: "Төлбөр олдсонгүй" });
  }

  const payment = pending[0];

  // Дүн хүрэхгүй бол confirmed болгохгүй
  if (paidAmount > 0 && paidAmount < payment.amount) {
    return NextResponse.json({ ok: false, msg: `Дүн хүрэхгүй: ${paidAmount} < ${payment.amount}` });
  }

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/pending_payments?ref_code=eq.${ref}&status=eq.pending`,
    {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ status: "confirmed", confirmed_at: new Date().toISOString() }),
    }
  );

  const data = await res.json();
  return NextResponse.json({ ok: true, ref, updated: data });
}
