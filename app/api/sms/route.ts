import { NextRequest, NextResponse } from "next/server";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
function parseRef(smsText: string): string | null {
  const match = smsText.match(/[Uu]tga[:\s.]*([A-Z0-9]+)/i);
  if (match) return match[1].toUpperCase().trim();
  return null;
}
function parseAmount(smsText: string): number | null {
  const match = smsText.match(/ORLOGO[:\s]+([\d,]+\.?\d*)\s*MNT/i);
  if (match) return Math.round(parseFloat(match[1].replace(/,/g, "")));
  return null;
}
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const smsText: string = body.text || body.message || body.sms || "";
    if (!smsText) return NextResponse.json({ error: "No SMS text" }, { status: 400 });
    if (!smsText.includes("ORLOGO")) return NextResponse.json({ ok: false, reason: "Not an income SMS" });
    const ref = parseRef(smsText);
    const amount = parseAmount(smsText);
    if (!ref) return NextResponse.json({ ok: false, reason: "No ref code found" });
    const checkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/pending_payments?ref_code=eq.${ref}&select=*`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    const rows = await checkRes.json();
    if (!Array.isArray(rows) || rows.length === 0) return NextResponse.json({ ok: false, reason: "Ref not found", ref });
    const payment = rows[0];
    if (payment.status === "confirmed") return NextResponse.json({ ok: true, ref, amount, already: true });
    await fetch(`${SUPABASE_URL}/rest/v1/pending_payments?ref_code=eq.${ref}`, {
      method: "PATCH",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ status: "confirmed", paid_amount: amount, confirmed_at: new Date().toISOString() }),
    });
    return NextResponse.json({ ok: true, ref, amount, film_id: payment.film_id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
