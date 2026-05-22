import { NextRequest, NextResponse } from "next/server";
const SUPABASE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) as string;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

async function dbFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
    },
    ...opts,
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
}

function extractRef(text: string): string | null {
  const m = text.match(/Utga[:\s]*([Kk][Nn]\d{4,8})/);
  if (m) return m[1].toUpperCase();
  const b = text.match(/KN\d{4,8}/i);
  if (b) return b[0].toUpperCase();
  return null;
}

function extractAmount(text: string): number | null {
  const m = text.match(/ORLOGO[:\s]*([\d,]+)\.?\d*MNT/i);
  if (m) return parseInt(m[1].replace(/,/g, ""));
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text: string = body.text || body.message || body.sms || "";
    if (!text) return NextResponse.json({ ok: false, error: "No text" }, { status: 400 });
    if (!text.toUpperCase().includes("ORLOGO")) return NextResponse.json({ ok: false, reason: "Not income SMS" });
    const ref = extractRef(text);
    if (!ref) return NextResponse.json({ ok: false, reason: "No KN code" });
    const amount = extractAmount(text);

    // pending_payments шалгах
    const rows = await dbFetch(`pending_payments?ref_code=eq.${ref}&select=*`);
    if (!Array.isArray(rows) || rows.length === 0) {
      await dbFetch("sms_logs", { method: "POST", body: JSON.stringify({ raw_text: text, ref_code: ref, amount, status: "not_found" }) });
      return NextResponse.json({ ok: false, reason: "No payment for " + ref });
    }

    // pending_payments confirmed болгох — Supabase REST PATCH
    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/pending_payments?ref_code=eq.${ref}`, {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
      },
      body: JSON.stringify({ status: "confirmed", confirmed_at: new Date().toISOString(), sms_text: text }),
    });
    const patchData = await patchRes.text();

    await dbFetch("sms_logs", { method: "POST", body: JSON.stringify({ raw_text: text, ref_code: ref, amount, status: "confirmed", film_id: rows[0].film_id }) });
    return NextResponse.json({ ok: true, ref_code: ref, film_id: rows[0].film_id, amount, patch: patchData });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "SMS webhook running" });
}
