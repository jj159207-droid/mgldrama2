import { NextRequest, NextResponse } from "next/server";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
export async function POST(req: NextRequest) {
  const body = await req.json(); const text = body.text || "";
  const match = text.match(/KNM?\d{4,8}/i);
  if (!match) { return NextResponse.json({ ok: false, msg: "KN kod oldsongu" }); }
  const ref = match[0].toUpperCase();
  let paidAmount = 0;
  const om = text.match(/ORLOGO:([\d,]+)[.\d]*MNT/i) || text.match(/ORLOGO[\s:]+([\d,]+)/i);
  if (om) { paidAmount = parseInt(om[1].replace(/,/g, "")); }
  const cr = await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL + "/rest/v1/pending_payments?ref_code=eq." + ref + "&status=eq.pending&select=*", { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, Authorization: "Bearer " + process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! } });
  const pending = await cr.json();
  if (!Array.isArray(pending) || pending.length === 0) { return NextResponse.json({ ok: false, msg: "Tölbör oldsongu" }); }
  const payment = pending[0];
  if (paidAmount > 0 && paidAmount < payment.amount) { return NextResponse.json({ ok: false, msg: "Dun hurkhgui: " + paidAmount + " < " + payment.amount }); }
  const res = await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL + "/rest/v1/pending_payments?ref_code=eq." + ref + "&status=eq.pending", { method: "PATCH", headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, Authorization: "Bearer " + process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify({ status: "confirmed", confirmed_at: new Date().toISOString() }) });
  const data = await res.json();
  return NextResponse.json({ ok: true, ref, updated: data });
}
