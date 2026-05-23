"use client";
import { useState, useRef, useEffect } from "react";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function dbFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    ...opts,
  });
  return res.json();
}

const ADMIN_KEY = "admin2024";

// ══════════════════════════════════════════════
// ДАНСНЫ МЭДЭЭЛЭЛ
// ══════════════════════════════════════════════
const BANK_ACCOUNT = {
  bank: "Хаан банк",
  number: "5402504824",
  name: "Т.Жаргалбаяр",
  shortNumber: "MN11000500",
};

function saveSession(user: any) { const s = { user, expires: Date.now() + 7 * 24 * 60 * 60 * 1000 }; localStorage.setItem("kino_session", JSON.stringify(s)); }
function loadSession() { try { const s = JSON.parse(localStorage.getItem("kino_session") || "{}"); if (s.user && s.expires > Date.now()) return s.user; localStorage.removeItem("kino_session"); } catch { } return null; }
function clearSession() { localStorage.removeItem("kino_session"); }
function genUserId(id: number) { return "#" + String(id).padStart(6, "0"); }

// Гүйлгээний утга үүсгэх — кино id + санамсаргүй 4 тоо
function genRef(filmId: number): string {
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `KN${filmId}${rand}`;
}

const BANKS = [
  { id: "khanbank", name: "Хаан банк", color: "#00a651", icon: "🏦", deep: "khanbank://qpay?amount=" },
  { id: "golomt", name: "Голомт банк", color: "#e4002b", icon: "🏦", deep: "golomtbank://qpay?amount=" },
  { id: "tdbbank", name: "ХАС банк", color: "#0033a0", icon: "🏦", deep: "tdb://qpay?amount=" },
  { id: "statebank", name: "Төрийн банк", color: "#2c5f9e", icon: "🏦", deep: "statebank://qpay?amount=" },
  { id: "mbank", name: "М банк", color: "#e8281e", icon: "📱", deep: "mbank://qpay?amount=" },
  { id: "most", name: "MOST", color: "#6c3fa0", icon: "📱", deep: "most://payment?amount=" },
  { id: "upoint", name: "U-Point", color: "#f97316", icon: "📱", deep: "upoint://pay?amount=" },
  { id: "socialpay", name: "SocialPay", color: "#0ea5e9", icon: "📱", deep: "socialpay://payment?amount=" },
];

const C = {
  bg: "#0d0d14", card: "#13131c", card2: "#1a1a26", bd: "#1e1e2e",
  txt: "#f0eefa", muted: "#6b6a90",
  red: "#e8281e", gold: "#e8a020", green: "#16a34a", blue: "#2563eb", amber: "#ca8a04",
};

const badgeColor = (b: string) => b === "Хадмал" ? C.amber : C.blue;

const inputSt: any = {
  width: "100%", background: "#0d0d18", border: `0.5px solid #1e1e2e`,
  borderRadius: 8, padding: "11px 13px", color: "#f0eefa", fontSize: 14,
  outline: "none", boxSizing: "border-box", fontFamily: "inherit",
};
const goldBtn: any = {
  width: "100%", background: C.gold, border: "none", color: "#000",
  padding: 13, borderRadius: 10, fontSize: 15, fontWeight: 700,
  cursor: "pointer", fontFamily: "inherit",
};
const lbl: any = { fontSize: 12, color: C.muted, display: "block", marginBottom: 5 };

// ══════════════════════════════════════════════
// БАНКНЫ МЭССЭЖ ОРЛУУЛАХ MODAL (Админ)
// Таны утасны орлогын мэссэжийг энд paste хийнэ
// ══════════════════════════════════════════════
function SmsVerifyModal({ onClose, onFound }: { onClose: () => void; onFound: (ref: string) => void }) {
  const [smsText, setSmsText] = useState("");
  const [err, setErr] = useState("");

  // Мэссэжнээс гүйлгээний утга олох
  // Жишээ мэссэж: "Орлого: 5,000₮ Гүйлгээний утга: KN3420 ..."
  // Хэд хэдэн форматыг дэмжинэ
  const extractRef = (text: string): string | null => {
    // KNxxxxxx pattern шалгах
    const match = text.match(/KN\d{5,8}/i);
    if (match) return match[0].toUpperCase();
    return null;
  };

  const verify = () => {
    const ref = extractRef(smsText);
    if (!ref) {
      setErr("Мэссэжнээс гүйлгээний утга олдсонгүй. 'KN' эхэлсэн кодыг шалгана уу.");
      return;
    }
    onFound(ref);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.95)", display: "flex", alignItems: "flex-end", zIndex: 300 }}>
      <div style={{ background: C.card, borderRadius: "18px 18px 0 0", padding: "20px 20px 40px", width: "100%", border: `0.5px solid ${C.bd}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.txt }}>📩 Банкны мэссэж оруулах</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, fontSize: 24, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ background: C.card2, borderRadius: 10, padding: "10px 14px", marginBottom: 14, border: `0.5px solid ${C.bd}` }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>📌 Жишээ мэссэж</div>
          <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: "monospace", lineHeight: 1.6 }}>
            Орлого 5,000₮ Гүйлгээний утга: <span style={{ color: C.gold }}>KN34208</span> Данс: XXXX1234 ...
          </div>
        </div>

        <label style={lbl}>Банкнаас ирсэн мэссэжийг доор хуулж тавина уу</label>
        <textarea
          value={smsText}
          onChange={(e: any) => { setSmsText(e.target.value); setErr(""); }}
          placeholder="Мэссэжийг энд paste хийнэ үү..."
          style={{
            ...inputSt, height: 110, resize: "none",
            lineHeight: 1.6, verticalAlign: "top",
          }}
        />
        {err && <div style={{ color: C.red, fontSize: 12, marginTop: 6 }}>{err}</div>}
        <button onClick={verify} style={{ ...goldBtn, marginTop: 14 }}>
          ✅ Тулгах
        </button>
        <button onClick={onClose} style={{ width: "100%", background: "none", border: `0.5px solid ${C.bd}`, color: C.muted, padding: 12, borderRadius: 10, fontSize: 14, cursor: "pointer", marginTop: 8 }}>Буцах</button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// ТӨЛБӨРИЙН MODAL — автомат polling + дансны мэдээлэл
// ══════════════════════════════════════════════
function BankModal({ film, onClose, onPaid, user }: any) {
  const [step, setStep] = useState<"waiting">("waiting");
  const [refCode] = useState(() => genRef(film.id));
  const [copied, setCopied] = useState<string | null>(null);
  const [autoStatus, setAutoStatus] = useState<"waiting" | "checking" | "paid" | "timeout">("waiting");
  const [showSms, setShowSms] = useState(false);
  const [manualChecking, setManualChecking] = useState(false);
  const intervalRef = useRef<any>(null);
  const timeoutRef = useRef<any>(null);

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  // Төлбөр үүсгэх + автомат polling эхлүүлэх
  useEffect(() => {
    if (step !== "waiting") return;

    // Supabase-д pending_payments үүсгэх
    dbFetch("pending_payments", {
      method: "POST",
      body: JSON.stringify({
        ref_code: refCode,
        film_id: film.id,
        amount: film.price,
        status: "pending",
        user_id: user?.id || null,
        plan: film.monthly ? "monthly" : "single",
      }),
    });

    // Автомат 5 секунд тутамд шалгах
    intervalRef.current = setInterval(async () => {
      setAutoStatus("checking");
      const rows = await dbFetch(
        `pending_payments?ref_code=eq.${refCode}&status=eq.confirmed&select=id`
      );
      if (Array.isArray(rows) && rows.length > 0) {
        clearInterval(intervalRef.current);
        clearTimeout(timeoutRef.current);
        setAutoStatus("paid");
        setTimeout(() => onPaid(), 1200);
      } else {
        setAutoStatus("waiting");
      }
    }, 5000);

    // 15 минутын дараа timeout
    timeoutRef.current = setTimeout(() => {
      clearInterval(intervalRef.current);
      setAutoStatus("timeout");
    }, 15 * 60 * 1000);

    return () => {
      clearInterval(intervalRef.current);
      clearTimeout(timeoutRef.current);
    };
  }, [step]);

  // SMS мэссэжнээс ref олсны дараа гараар шалгах
  const handleSmsFound = async (foundRef: string) => {
    setShowSms(false);
    setManualChecking(true);
    const rows = await dbFetch(
      `pending_payments?ref_code=eq.${foundRef}&film_id=eq.${film.id}&select=*`
    );
    if (Array.isArray(rows) && rows.length > 0 && rows[0].status === "pending") {
      await dbFetch(`pending_payments?ref_code=eq.${foundRef}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "confirmed", confirmed_at: new Date().toISOString() }),
      });
      setManualChecking(false);
      setAutoStatus("paid");
      setTimeout(() => onPaid(), 1200);
    } else if (Array.isArray(rows) && rows.length > 0 && rows[0].status === "confirmed") {
      setManualChecking(false);
      setAutoStatus("paid");
      setTimeout(() => onPaid(), 1200);
    } else {
      setManualChecking(false);
      alert(`"${foundRef}" кодтой төлбөр олдсонгүй. Гүйлгээний утгыг зөв бичсэн эсэхийг шалгана уу.`);
    }
  };

  if (autoStatus === "paid") {
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.97)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 72, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.green }}>Төлбөр баталгаажлаа!</div>
          <div style={{ fontSize: 14, color: C.muted, marginTop: 8 }}>Кино эхэлж байна...</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.95)", display: "flex", alignItems: "flex-end", zIndex: 200 }}>
        <div style={{ background: C.card, borderRadius: "18px 18px 0 0", padding: "20px 20px 36px", width: "100%", border: `0.5px solid ${C.bd}`, maxHeight: "92vh", overflowY: "auto" }}>

          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: C.txt }}>{film.title}</span>
            <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, fontSize: 24, cursor: "pointer" }}>✕</button>
          </div>

          {/* Үнэ */}
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 36, fontWeight: 900, color: C.gold }}>{film.price?.toLocaleString()}₮</div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>дараах данс руу шилжүүлнэ үү</div>
          </div>

          {/* Дансны мэдээлэл */}
          <div style={{ background: "#050d1a", border: `1.5px solid ${C.gold}`, borderRadius: 14, padding: "16px 18px", marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 12, letterSpacing: "0.08em", textTransform: "uppercase" }}>🏦 Дансны мэдээлэл</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: C.muted }}>Банк</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.txt }}>{BANK_ACCOUNT.bank}</span>
            </div>
            {/* Дансны дугаар — том, дарахад copy */}
            <div
              onClick={() => copyText(BANK_ACCOUNT.number, "account")}
              style={{ background: copied === "account" ? "#052e16" : "#0a1628", border: `1.5px solid ${copied === "account" ? C.green : C.gold}`, borderRadius: 12, padding: "14px 16px", textAlign: "center", cursor: "pointer", marginBottom: 8, transition: "all 0.2s" }}
            >
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Дансны дугаар — дарж хуулна уу</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: copied === "account" ? C.green : "#fbbf24", fontFamily: "monospace", letterSpacing: "0.1em" }}>
                {BANK_ACCOUNT.number}
              </div>
              <div style={{ fontSize: 12, color: copied === "account" ? C.green : C.muted, marginTop: 4 }}>
                {copied === "account" ? "✅ Хуулагдлаа!" : "👆 Дарж хуулах"}
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: C.muted }}>Эзэмшигч</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.txt }}>{BANK_ACCOUNT.name}</span>
            </div>
          </div>

          {/* Гүйлгээний утга — маш том */}
          <div style={{ background: "#1a0a00", border: `2px solid #f97316`, borderRadius: 14, padding: "18px 16px", marginBottom: 14, textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "#f97316", marginBottom: 8, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700 }}>
              ⚠️ Гүйлгээний утга — заавал бичнэ!
            </div>
            <div style={{ fontSize: 38, fontWeight: 900, color: "#fb923c", letterSpacing: "0.2em", fontFamily: "monospace", marginBottom: 12 }}>
              {refCode}
            </div>
            <button onClick={() => copyText(refCode, "ref")} style={{ background: copied === "ref" ? C.green : "#2a1500", border: `0.5px solid #f97316`, borderRadius: 8, padding: "10px 28px", fontSize: 14, color: copied === "ref" ? "#fff" : "#fb923c", cursor: "pointer", fontWeight: 700 }}>
              {copied === "ref" ? "✅ Хуулагдлаа!" : "📋 Код хуулах"}
            </button>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>Энэ кодыг бичихгүй бол автоматаар таних боломжгүй</div>
          </div>

          {/* Автомат хүлээж байна */}
          <div style={{ background: C.card2, borderRadius: 10, padding: "10px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 20 }}>{autoStatus === "checking" ? "🔄" : "⏳"}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.txt }}>
                {autoStatus === "checking" ? "Шалгаж байна..." : "Төлбөрийг хүлээж байна"}
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Мөнгө шилжүүлсний дараа автоматаар нээгдэнэ</div>
            </div>
          </div>

          <button onClick={() => setShowSms(true)} disabled={manualChecking} style={{ ...goldBtn, opacity: manualChecking ? 0.6 : 1, marginBottom: 8 }}>
            {manualChecking ? "Шалгаж байна..." : "📩 Банкны мэссэж тулгах"}
          </button>
          <button onClick={onClose} style={{ width: "100%", background: "none", border: `0.5px solid ${C.bd}`, color: C.muted, padding: 12, borderRadius: 10, fontSize: 14, cursor: "pointer" }}>Буцах</button>
        </div>
      </div>
      {showSms && <SmsVerifyModal onClose={() => setShowSms(false)} onFound={handleSmsFound} />}
    </>
  );
}

// ══════════════════════════════════════════════
// ADMIN — мэссэж шалгах таб нэмэгдлээ
// ══════════════════════════════════════════════
function AdminSmsTab() {
  const [smsText, setSmsText] = useState("");
  const [result, setResult] = useState<any>(null);
  const [status, setStatus] = useState<"idle" | "checking" | "found" | "notfound">("idle");

  const extractRef = (text: string): string | null => {
    const match = text.match(/KN\d{5,8}/i);
    if (match) return match[0].toUpperCase();
    return null;
  };

  const check = async () => {
    const ref = extractRef(smsText);
    if (!ref) { setStatus("notfound"); setResult(null); return; }
    setStatus("checking");
    const rows = await dbFetch(`pending_payments?ref_code=eq.${ref}&select=*`);
    if (Array.isArray(rows) && rows.length > 0) {
      setResult(rows[0]);
      setStatus("found");
    } else {
      setResult(null);
      setStatus("notfound");
    }
  };

  const confirm = async () => {
    if (!result) return;
    await dbFetch(`pending_payments?ref_code=eq.${result.ref_code}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "confirmed" }),
    });
    setResult((r: any) => ({ ...r, status: "confirmed" }));
  };

  return (
    <div style={{ padding: "0 14px" }}>
      <div style={{ background: C.card, border: `0.5px solid ${C.bd}`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.txt, marginBottom: 12 }}>📩 Банкны мэссэж шалгах</div>
        <label style={lbl}>Орлогын мэссэжийг paste хийнэ үү</label>
        <textarea
          value={smsText}
          onChange={(e: any) => { setSmsText(e.target.value); setStatus("idle"); setResult(null); }}
          placeholder={"Орлого 5,000₮ Гүйлгээний утга: KN34208 ..."}
          style={{ ...inputSt, height: 100, resize: "none", lineHeight: 1.6 }}
        />
        <button onClick={check} style={{ ...goldBtn, marginTop: 10 }}>
          🔍 Шалгах
        </button>
      </div>

      {status === "checking" && (
        <div style={{ textAlign: "center", color: C.muted, padding: 16 }}>Шалгаж байна...</div>
      )}

      {status === "found" && result && (
        <div style={{ background: result.status === "confirmed" ? "#052e16" : "#1c1400", border: `0.5px solid ${result.status === "confirmed" ? "#166534" : C.gold}`, borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: result.status === "confirmed" ? "#4ade80" : C.gold, marginBottom: 10 }}>
            {result.status === "confirmed" ? "✅ Баталгаажсан" : "⏳ Хүлээгдэж байна"}
          </div>
          <div style={{ fontSize: 12, color: C.muted, lineHeight: 2 }}>
            Код: <span style={{ color: C.txt, fontFamily: "monospace" }}>{result.ref_code}</span><br />
            Кино ID: <span style={{ color: C.txt }}>{result.film_id}</span><br />
            Дүн: <span style={{ color: C.gold }}>{result.amount?.toLocaleString()}₮</span>
          </div>
          {result.status === "pending" && (
            <button onClick={confirm} style={{ ...goldBtn, marginTop: 12 }}>
              ✅ Гараар баталгаажуулах
            </button>
          )}
        </div>
      )}

      {status === "notfound" && (
        <div style={{ background: "#1a0808", border: `0.5px solid #3a1a1a`, borderRadius: 12, padding: 14, color: "#f05555", fontSize: 13 }}>
          ❌ Мэссэжнээс тохирох гүйлгээ олдсонгүй
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════
// Дараах компонентууд өмнөхтэй адил үлдсэн
// ══════════════════════════════════════════════
function QRCanvas({ text }: { text: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const S = 140, N = 21, sz = Math.floor(S / N);
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = "#000";
    const seed = [...text].reduce((a, ch) => a + ch.charCodeAt(0), 0);
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const v = (r * N + c + seed) % 7;
      const corner = (r < 7 && c < 7) || (r < 7 && c >= N - 7) || (r >= N - 7 && c < 7);
      if (corner || v < 3) ctx.fillRect(c * sz, r * sz, sz, sz);
    }
    ([[0, 0], [0, N - 7], [N - 7, 0]] as number[][]).forEach(([r, c]) => {
      ctx.strokeStyle = "#000"; ctx.lineWidth = sz;
      ctx.strokeRect((c + .5) * sz, (r + .5) * sz, 6 * sz, 6 * sz);
      ctx.fillRect((c + 2) * sz, (r + 2) * sz, 3 * sz, 3 * sz);
    });
  }, [text]);
  return <canvas ref={ref} width={140} height={140} style={{ borderRadius: 6, display: "block" }} />;
}

function FilmCard({ film, onClick }: any) {
  return (
    <div onClick={onClick} style={{ background: C.card, borderRadius: 12, overflow: "hidden", cursor: "pointer", border: `0.5px solid ${C.bd}`, WebkitTapHighlightColor: "transparent" }}>
      <div style={{ position: "relative", aspectRatio: "3/4", overflow: "hidden" }}>
        {film.img
          ? <img src={film.img} alt={film.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <div style={{ width: "100%", height: "100%", background: `linear-gradient(160deg,${film.bg || "#1a0820"} 0%,#000 100%)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 44 }}>🎬</span>
          </div>
        }
        <div style={{ position: "absolute", top: 8, left: 8, background: badgeColor(film.badge), borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 700, color: "#fff" }}>
          {film.badge}
        </div>
        {!film.free && film.locked && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 28 }}>🔒</span>
          </div>
        )}
      </div>
      <div style={{ padding: "7px 8px 10px" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.txt, lineHeight: 1.3, marginBottom: 5 }}>{film.title}</div>
        {!film.free && <div style={{ fontSize: 10, color: C.muted, textDecoration: "line-through", marginBottom: 1 }}>{film.op?.toLocaleString()}₮</div>}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: film.free ? C.green : C.gold }}>
            {film.free ? "Үнэгүй" : `${film.price?.toLocaleString()}₮`}
          </span>
          {film.free
            ? <button style={{ background: C.green, border: "none", color: "#fff", borderRadius: 16, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>▶ Үзэх</button>
            : <button style={{ background: C.gold, border: "none", color: "#000", borderRadius: 16, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>💳</button>
          }
        </div>
      </div>
    </div>
  );
}

function ContactModal({ onClose, user }: any) {
  const [msg, setMsg] = useState("");
  const [phone, setPhone] = useState(user?.phone || "");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!phone || !msg.trim()) return;
    setSending(true);
    await dbFetch("contact_messages", {
      method: "POST",
      body: JSON.stringify({ phone, message: msg.trim(), user_id: user?.id || null, read: false }),
    });
    setSent(true);
    setSending(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.95)", display: "flex", alignItems: "flex-end", zIndex: 300 }}>
      <div style={{ background: C.card, borderRadius: "18px 18px 0 0", padding: "20px 20px 40px", width: "100%", border: `0.5px solid ${C.bd}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.txt }}>💬 Админтай холбогдох</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, fontSize: 24, cursor: "pointer" }}>✕</button>
        </div>
        {sent ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.green }}>Мессеж илгээгдлээ!</div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 8 }}>Удахгүй холбогдох болно</div>
            <button onClick={onClose} style={{ ...goldBtn, marginTop: 20 }}>Хаах</button>
          </div>
        ) : (
          <>
            <label style={lbl}>Утасны дугаар</label>
            <input style={inputSt} value={phone} onChange={(e: any) => setPhone(e.target.value)} placeholder="99001234" type="tel" maxLength={8} />
            <label style={{ ...lbl, marginTop: 12 }}>Мессеж</label>
            <textarea
              value={msg}
              onChange={(e: any) => setMsg(e.target.value)}
              placeholder="Асуудал эсвэл асуулт бичнэ үү..."
              style={{ ...inputSt, height: 100, resize: "none", lineHeight: 1.6 }}
            />
            <button onClick={send} disabled={sending || !phone || !msg.trim()} style={{ ...goldBtn, marginTop: 14, opacity: sending || !phone || !msg.trim() ? 0.6 : 1 }}>
              {sending ? "Илгээж байна..." : "📨 Илгээх"}
            </button>
            <button onClick={onClose} style={{ width: "100%", background: "none", border: `0.5px solid ${C.bd}`, color: C.muted, padding: 11, borderRadius: 10, fontSize: 13, cursor: "pointer", marginTop: 8 }}>Буцах</button>
          </>
        )}
      </div>
    </div>
  );
}

function LoginPage({ onLogin, onBack }: any) {
  const [mode, setMode] = useState<"login" | "register" | "reset">("login");
  const [phone, setPhone] = useState(""); const [pin, setPin] = useState(""); const [pin2, setPin2] = useState("");
  const [err, setErr] = useState(""); const [loading, setLoading] = useState(false);
  const register = async () => {
    if (phone.length < 8) { setErr("Утасны дугаар буруу байна"); return; }
    if (pin.length !== 4 || !/^\d+$/.test(pin)) { setErr("PIN 4 оронтой тоо байх ёстой"); return; }
    if (pin !== pin2) { setErr("PIN таарахгүй байна"); return; }
    setLoading(true); setErr("");
    const exists = await dbFetch(`users?phone=eq.${phone}&select=id`);
    if (Array.isArray(exists) && exists.length > 0) { setErr("Энэ дугаар бүртгэлтэй байна"); setLoading(false); return; }
    const data = await dbFetch("users", { method: "POST", body: JSON.stringify({ phone, pin, user_id: "tmp", failed_attempts: 0 }) });
    if (data?.[0]?.id) {
      const uid = genUserId(data[0].id);
      await dbFetch(`users?id=eq.${data[0].id}`, { method: "PATCH", body: JSON.stringify({ user_id: uid }) });
      saveSession({ ...data[0], user_id: uid }); onLogin({ ...data[0], user_id: uid });
    } else { setErr("Бүртгэл амжилтгүй"); }
    setLoading(false);
  };
  const login = async () => {
    if (!phone || !pin) { setErr("Дугаар болон PIN оруулна уу"); return; }
    setLoading(true); setErr("");
    const data = await dbFetch(`users?phone=eq.${phone}&select=*`);
    if (!Array.isArray(data) || data.length === 0) { setErr("Бүртгэлгүй дугаар"); setLoading(false); return; }
    const user = data[0];
    if (user.locked_until && new Date(user.locked_until) > new Date()) { setErr("Хэт олон удаа буруу оруулсан. Түр хүлээнэ үү"); setLoading(false); return; }
    if (user.pin !== pin) {
      const attempts = (user.failed_attempts || 0) + 1;
      const locked = attempts >= 3 ? { locked_until: new Date(Date.now() + 15 * 60 * 1000).toISOString() } : {};
      await dbFetch(`users?id=eq.${user.id}`, { method: "PATCH", body: JSON.stringify({ failed_attempts: attempts, ...locked }) });
      setErr(attempts >= 3 ? "3 удаа буруу оруулсан. 15 минут хүлээнэ үү" : `PIN буруу байна (${3 - attempts} оролдлого үлдсэн)`);
      setLoading(false); return;
    }
    await dbFetch(`users?id=eq.${user.id}`, { method: "PATCH", body: JSON.stringify({ failed_attempts: 0, locked_until: null }) });
    saveSession(user); onLogin(user); setLoading(false);
  };
  const resetPin = async () => {
    if (phone.length < 8) { setErr("Утасны дугаар буруу байна"); return; }
    if (pin.length !== 4 || !/^\d+$/.test(pin)) { setErr("Шинэ PIN 4 оронтой тоо байх ёстой"); return; }
    if (pin !== pin2) { setErr("PIN таарахгүй байна"); return; }
    setLoading(true); setErr("");
    const data = await dbFetch(`users?phone=eq.${phone}&select=id`);
    if (!Array.isArray(data) || data.length === 0) { setErr("Бүртгэлгүй дугаар"); setLoading(false); return; }
    await dbFetch(`users?id=eq.${data[0].id}`, { method: "PATCH", body: JSON.stringify({ pin, failed_attempts: 0, locked_until: null }) });
    setErr(""); setMode("login"); alert("PIN амжилттай солигдлоо!"); setLoading(false);
  };
  return (
    <div style={{ background: C.bg, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ fontSize: 40, marginBottom: 8 }}>🎬</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: C.txt, marginBottom: 4, fontFamily: "Georgia,serif" }}>кино үзэх самбар</div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 24 }}>{mode === "login" ? "Нэвтрэх" : mode === "register" ? "Бүртгүүлэх" : "PIN сэргээх"}</div>
      <div style={{ width: "100%", maxWidth: 340, background: C.card, borderRadius: 16, padding: 20, border: `0.5px solid ${C.bd}` }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {(["login", "register", "reset"] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setErr(""); }} style={{ flex: 1, padding: "12px 4px", borderRadius: 10, border: "none", background: mode === m ? C.gold : C.card2, color: mode === m ? "#000" : "#a0a0c0", fontWeight: 800, cursor: "pointer", fontSize: 13 }}>
              {m === "login" ? "Нэвтрэх" : m === "register" ? "Бүртгүүлэх" : "PIN сэргээх"}
            </button>
          ))}
        </div>
        <label style={lbl}>Утасны дугаар</label>
        <input style={inputSt} value={phone} onChange={(e: any) => setPhone(e.target.value)} placeholder="99001234" type="tel" maxLength={8} />
        <label style={{ ...lbl, marginTop: 10 }}>{mode === "reset" ? "Шинэ PIN" : "PIN код (4 оронтой)"}</label>
        <input style={inputSt} value={pin} onChange={(e: any) => setPin(e.target.value)} placeholder="****" type="password" maxLength={4} />
        {mode !== "login" && <>
          <label style={{ ...lbl, marginTop: 10 }}>PIN давтах</label>
          <input style={inputSt} value={pin2} onChange={(e: any) => setPin2(e.target.value)} placeholder="****" type="password" maxLength={4} />
        </>}
        {err && <div style={{ color: C.red, fontSize: 12, marginTop: 8 }}>{err}</div>}
        <button onClick={mode === "login" ? login : mode === "register" ? register : resetPin} disabled={loading} style={{ ...goldBtn, marginTop: 14, opacity: loading ? 0.6 : 1 }}>
          {loading ? "Түр хүлээнэ үү..." : mode === "login" ? "🔓 Нэвтрэх" : mode === "register" ? "✅ Бүртгүүлэх" : "🔄 PIN солих"}
        </button>
        <button onClick={onBack} style={{ width: "100%", background: "none", border: `0.5px solid ${C.bd}`, color: C.muted, padding: 11, borderRadius: 10, fontSize: 13, cursor: "pointer", marginTop: 8 }}>Буцах</button>
      </div>
    </div>
  );
}

function HomePage({ films, onFilm, onSearch, onAdmin, loading, user, onLogin, onLogout, onMonthly, onContact }: any) {
  return (
    <div style={{ background: C.bg, minHeight: "100vh", paddingBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: C.bg, position: "sticky", top: 0, zIndex: 10, borderBottom: `0.5px solid ${C.bd}` }}>
        <div style={{ fontFamily: "Georgia,serif", fontSize: 20, fontWeight: 800, color: C.txt }}>кино үзэх самбар</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={onSearch} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 20 }}>🔍</button>
          {user
            ? <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, color: C.gold, fontWeight: 700 }}>{user.user_id}</span>
              <button onClick={onLogout} style={{ background: C.card2, border: `0.5px solid ${C.bd}`, color: C.muted, cursor: "pointer", fontSize: 11, borderRadius: 8, padding: "5px 8px" }}>Гарах</button>
            </div>
            : <button onClick={onLogin} style={{ background: C.gold, border: "none", color: "#000", cursor: "pointer", fontSize: 12, borderRadius: 8, padding: "6px 10px", fontWeight: 700 }}>Нэвтрэх</button>
          }
          <button onClick={onContact} style={{ background: C.card2, border: `0.5px solid ${C.bd}`, color: C.muted, cursor: "pointer", fontSize: 12, borderRadius: 8, padding: "6px 10px" }}>💬</button>
          <button onClick={onAdmin} style={{ background: C.card2, border: `0.5px solid ${C.bd}`, color: C.muted, cursor: "pointer", fontSize: 12, borderRadius: 8, padding: "6px 10px" }}>⚙️</button>
        </div>
      </div>
      <div onClick={onLogin} style={{ margin: "12px 12px 8px", background: "linear-gradient(90deg,#0369a1,#0ea5e9)", borderRadius: 14, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
        <span style={{ fontSize: 26 }}>🎬</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>Нэвтрэх / Бүртгүүлэх</div>
          <div style={{ fontSize: 13, color: "#bae6fd" }}>Киногоо үзэхийн тулд нэвтэрнэ үү</div>
        </div>
      </div>
      {/* Сарын багц товч */}
      <div onClick={onMonthly} style={{ margin: "0 12px 12px", background: "linear-gradient(90deg,#7c3aed,#a855f7)", borderRadius: 14, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 26 }}>👑</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>1 Сарын багц</div>
            <div style={{ fontSize: 12, color: "#e9d5ff" }}>Бүх кино — хязгааргүй үзэх</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#fff" }}>11,500₮</div>
          <div style={{ fontSize: 11, color: "#e9d5ff" }}>/ сар</div>
        </div>
      </div>
      <div style={{ padding: "8px 12px 6px" }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: C.txt }}>{films.length} кино байна</span>
      </div>
      {loading
        ? <div style={{ textAlign: "center", padding: 40, color: C.muted }}>Ачааллаж байна...</div>
        : <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: "0 10px" }}>
          {films.map((f: any) => <FilmCard key={f.id} film={f} onClick={() => onFilm(f)} />)}
        </div>
      }
    </div>
  );
}

function getVideoEmbed(url: string): { type: "iframe" | "video" | "youtube"; src: string } {
  if (!url) return { type: "iframe", src: "" };
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return { type: "youtube", src: `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&rel=0&modestbranding=1&playsinline=1` };
  if (url.match(/\.(mp4|webm|ogg|mov)(\?|$)/i)) return { type: "video", src: url };
  const gdMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (gdMatch) return { type: "iframe", src: `https://drive.google.com/file/d/${gdMatch[1]}/preview` };
  return { type: "iframe", src: url };
}

function VideoPage({ film, onBack }: any) {
  const [showControls, setShowControls] = useState(true);
  const { type, src } = getVideoEmbed(film.url || "");
  useEffect(() => {
    const t = setTimeout(() => setShowControls(false), 4000);
    window.history.pushState({ video: true }, "");
    const handlePop = () => { onBack(); };
    window.addEventListener("popstate", handlePop);
    return () => { clearTimeout(t); window.removeEventListener("popstate", handlePop); };
  }, []);
  return (
    <div onClick={() => setShowControls(v => !v)} style={{ background: "#000", position: "fixed", inset: 0, zIndex: 50 }}>
      {src ? (
        type === "video"
          ? <video src={src} autoPlay controls playsInline style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
          : <iframe src={src} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }} allowFullScreen allow="autoplay; fullscreen; picture-in-picture" />
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: C.muted, fontSize: 14 }}>Видео холбоос байхгүй байна</div>
      )}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, background: "linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)", padding: "16px", transition: "opacity 0.3s", opacity: showControls ? 1 : 0, pointerEvents: showControls ? "auto" : "none" }}>
        <button onClick={(e) => { e.stopPropagation(); onBack(); }} style={{ background: "rgba(0,0,0,0.5)", border: "none", color: "#fff", fontSize: 22, cursor: "pointer", borderRadius: 50, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(10px)" }}>←</button>
      </div>
    </div>
  );
}

function SearchPage({ films, onFilm, onBack }: any) {
  const [q, setQ] = useState("");
  const res = q ? films.filter((f: any) => f.title.toLowerCase().includes(q.toLowerCase())) : films;
  return (
    <div style={{ background: C.bg, minHeight: "100vh" }}>
      <div style={{ background: C.card, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, borderBottom: `0.5px solid ${C.bd}` }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.muted, fontSize: 22, cursor: "pointer" }}>←</button>
        <input autoFocus value={q} onChange={(e: any) => setQ(e.target.value)} placeholder="Кино хайх..." style={{ ...inputSt, flex: 1 }} />
      </div>
      <div style={{ padding: "12px 14px" }}>
        {q && res.length === 0 && <p style={{ color: C.muted, textAlign: "center", marginTop: 40 }}>Олдсонгүй</p>}
        {res.map((f: any) => (
          <div key={f.id} onClick={() => onFilm(f)} style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 0", borderBottom: `0.5px solid ${C.bd}`, cursor: "pointer" }}>
            <div style={{ width: 44, height: 60, borderRadius: 6, background: f.bg || "#1a0820", flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {f.img ? <img src={f.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 20 }}>🎬</span>}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.txt }}>{f.title}</div>
              <div style={{ fontSize: 12, color: f.free ? C.green : C.gold, marginTop: 3 }}>{f.free ? "Үнэгүй" : `${f.price?.toLocaleString()}₮`}</div>
            </div>
            {!f.free && f.locked && <span style={{ fontSize: 16 }}>🔒</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminLogin({ onEnter, onBack }: any) {
  const [key, setKey] = useState(""); const [err, setErr] = useState(false);
  const go = () => { if (key === ADMIN_KEY) { onEnter(); } else { setErr(true); } };
  return (
    <div style={{ background: C.bg, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🔐</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: C.txt, marginBottom: 20 }}>Админ нэвтрэх</div>
      <div style={{ width: "100%", maxWidth: 320 }}>
        <input type="password" value={key} onChange={(e: any) => setKey(e.target.value)} placeholder="Нууц код" style={inputSt} onKeyDown={(e: any) => e.key === "Enter" && go()} />
        {err && <p style={{ color: "#f05555", fontSize: 12, marginTop: 6 }}>Нууц код буруу байна</p>}
        <button onClick={go} style={{ ...goldBtn, marginTop: 12 }}>Нэвтрэх</button>
        <button onClick={onBack} style={{ width: "100%", background: "none", border: `0.5px solid ${C.bd}`, color: C.muted, padding: 12, borderRadius: 10, fontSize: 14, cursor: "pointer", marginTop: 8 }}>Буцах</button>
      </div>
    </div>
  );
}

function AdminOrdersTab() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [films, setFilms] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    const [pend, fl, us] = await Promise.all([
      dbFetch("pending_payments?order=created_at.desc&limit=50&select=*"),
      dbFetch("films?select=id,title"),
      dbFetch("users?select=id,phone,user_id"),
    ]);
    setOrders(Array.isArray(pend) ? pend : []);
    setFilms(Array.isArray(fl) ? fl : []);
    setUsers(Array.isArray(us) ? us : []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const confirmOrder = async (ref_code: string) => {
    setConfirming(ref_code);
    await dbFetch(`pending_payments?ref_code=eq.${ref_code}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "confirmed" }),
    });
    await load();
    setConfirming(null);
  };

  const getFilmTitle = (id: number) => id === 0 ? "👑 Сарын багц" : films.find((f: any) => f.id === id)?.title || `#${id}`;
  const getPhone = (uid: number) => uid ? (users.find((u: any) => u.id === uid)?.phone || "—") : "—";

  const statusColor = (s: string) => s === "confirmed" ? C.green : s === "pending" ? C.gold : C.muted;
  const statusLabel = (s: string) => s === "confirmed" ? "✅ Баталгаажсан" : "⏳ Хүлээгдэж байна";

  return (
    <div style={{ padding: "0 14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: C.muted }}>{orders.filter((o: any) => o.status === "pending").length} хүлээгдэж байна</span>
        <button onClick={load} style={{ background: C.card2, border: `0.5px solid ${C.bd}`, borderRadius: 8, padding: "6px 12px", color: C.muted, fontSize: 12, cursor: "pointer" }}>🔄 Шинэчлэх</button>
      </div>
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: C.muted }}>Ачааллаж байна...</div>
      ) : orders.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: C.muted }}>Захиалга байхгүй байна</div>
      ) : (
        orders.map((o: any) => (
          <div key={o.id} style={{ background: C.card, border: `0.5px solid ${o.status === "pending" ? C.gold : C.bd}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#fb923c", fontFamily: "monospace" }}>{o.ref_code}</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{getFilmTitle(o.film_id)}</div>
                <div style={{ fontSize: 12, color: C.gold, marginTop: 2 }}>📞 {getPhone(o.user_id)}</div>
                {o.plan === "monthly" && <div style={{ fontSize: 11, color: "#a855f7", marginTop: 2 }}>👑 Сарын багц</div>}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.gold }}>{o.amount?.toLocaleString()}₮</div>
                <div style={{ fontSize: 11, color: statusColor(o.status), marginTop: 2 }}>{statusLabel(o.status)}</div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: o.status === "pending" ? 10 : 0 }}>
              {new Date(o.created_at).toLocaleString("mn-MN")}
            </div>
            {o.status === "pending" && (
              <button
                onClick={() => confirmOrder(o.ref_code)}
                disabled={confirming === o.ref_code}
                style={{ width: "100%", background: confirming === o.ref_code ? C.card2 : "#166534", border: "none", borderRadius: 8, padding: "10px", color: confirming === o.ref_code ? C.muted : "#4ade80", fontSize: 13, fontWeight: 700, cursor: confirming === o.ref_code ? "default" : "pointer" }}
              >
                {confirming === o.ref_code ? "Баталгаажуулж байна..." : "✅ Гараар баталгаажуулах"}
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function AdminContactTab() {
  const [msgs, setMsgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const data = await dbFetch("contact_messages?order=created_at.desc&limit=50&select=*");
    setMsgs(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const markRead = async (id: number) => {
    await dbFetch(`contact_messages?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ read: true }) });
    setMsgs(ms => ms.map(m => m.id === id ? { ...m, read: true } : m));
  };

  return (
    <div style={{ padding: "0 14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: C.muted }}>{msgs.filter(m => !m.read).length} шинэ мессеж</span>
        <button onClick={load} style={{ background: C.card2, border: `0.5px solid ${C.bd}`, borderRadius: 8, padding: "6px 12px", color: C.muted, fontSize: 12, cursor: "pointer" }}>🔄 Шинэчлэх</button>
      </div>
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: C.muted }}>Ачааллаж байна...</div>
      ) : msgs.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: C.muted }}>Мессеж байхгүй байна</div>
      ) : (
        msgs.map(m => (
          <div key={m.id} style={{ background: C.card, border: `0.5px solid ${m.read ? C.bd : C.gold}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.gold }}>📞 {m.phone}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{new Date(m.created_at).toLocaleString("mn-MN")}</div>
              </div>
              {!m.read && <span style={{ fontSize: 11, background: C.gold, color: "#000", borderRadius: 6, padding: "2px 8px", fontWeight: 700 }}>Шинэ</span>}
            </div>
            <div style={{ fontSize: 13, color: C.txt, background: C.card2, borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>{m.message}</div>
            {!m.read && (
              <button onClick={() => markRead(m.id)} style={{ background: "#166534", border: "none", borderRadius: 8, padding: "8px 16px", color: "#4ade80", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                ✅ Уншсан
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function AdminPage({ films, onBack, onRefresh }: any) {
  const [tab, setTab] = useState<"list" | "add" | "sms" | "orders">("list");
  const [editId, setEditId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [imgVal, setImgVal] = useState(""); const [urlVal, setUrlVal] = useState("");
  const empty = { title: "", views: 0, op: 6000, price: 4000, badge: "Хэлтэй", free: false, locked: true, url: "", img: "", bg: "#1a0820" };
  const [form, setForm] = useState<any>(empty);
  const set = (k: string) => (e: any) => setForm((f: any) => ({ ...f, [k]: e.target.value }));
  const setChk = (k: string) => (e: any) => setForm((f: any) => ({ ...f, [k]: e.target.checked }));
  const save = async () => {
    if (!form.title.trim()) { alert("Гарчиг оруулна уу"); return; }
    setSaving(true);
    await dbFetch("films", { method: "POST", body: JSON.stringify({ ...form, views: parseInt(form.views) || 0, op: parseInt(form.op) || 6000, price: parseInt(form.price) || 0 }) });
    setSaving(false); setForm(empty); setTab("list"); onRefresh();
  };
  const deletFilm = async (id: number) => {
    if (!window.confirm("Устгах уу?")) return;
    await dbFetch(`films?id=eq.${id}`, { method: "DELETE" }); onRefresh();
  };
  const toggleLock = async (film: any) => {
    await dbFetch(`films?id=eq.${film.id}`, { method: "PATCH", body: JSON.stringify({ locked: !film.locked }) }); onRefresh();
  };
  const updateImg = async (id: number, img: string) => { await dbFetch(`films?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ img }) }); setEditId(null); onRefresh(); };
  const updateUrl = async (id: number, url: string) => { await dbFetch(`films?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ url }) }); setEditId(null); onRefresh(); };

  return (
    <div style={{ background: C.bg, minHeight: "100vh", paddingBottom: 30 }}>
      <div style={{ background: C.card, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `0.5px solid ${C.bd}`, position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: C.muted, fontSize: 22, cursor: "pointer" }}>←</button>
          <span style={{ fontSize: 15, fontWeight: 700, color: C.txt }}>Кино удирдах</span>
        </div>
        <span style={{ fontSize: 12, color: C.muted }}>{films.length} кино</span>
      </div>
      <div style={{ display: "flex", padding: "10px 14px", gap: 6 }}>
        <button onClick={() => setTab("list")} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: tab === "list" ? C.gold : C.card2, color: tab === "list" ? "#000" : C.muted, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>📋 Жагсаалт</button>
        <button onClick={() => setTab("orders")} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: tab === "orders" ? C.gold : C.card2, color: tab === "orders" ? "#000" : C.muted, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>🧾 Захиалга</button>
        <button onClick={() => setTab("add")} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: tab === "add" ? C.gold : C.card2, color: tab === "add" ? "#000" : C.muted, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>➕ Нэмэх</button>
        <button onClick={() => setTab("sms")} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: tab === "sms" ? C.gold : C.card2, color: tab === "sms" ? "#000" : C.muted, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>💬 Холбогдох</button>
      </div>

      {tab === "orders" && <AdminOrdersTab />}
      {tab === "sms" && <AdminContactTab />}

      {tab === "add" && (
        <div style={{ padding: "0 14px" }}>
          <div style={{ background: C.card, border: `0.5px solid ${C.bd}`, borderRadius: 12, padding: 16 }}>
            <label style={lbl}>Гарчиг *</label>
            <input style={inputSt} value={form.title} onChange={set("title")} placeholder="Кино нэр" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
              <div><label style={lbl}>Үзсэн тоо</label><input style={inputSt} value={form.views} onChange={set("views")} type="number" /></div>
              <div><label style={lbl}>Badge</label>
                <select style={inputSt} value={form.badge} onChange={set("badge")}><option>Хэлтэй</option><option>Хадмал</option></select>
              </div>
              <div><label style={lbl}>Хуучин үнэ ₮</label><input style={inputSt} value={form.op} onChange={set("op")} type="number" /></div>
              <div><label style={lbl}>Зарах үнэ ₮</label><input style={inputSt} value={form.price} onChange={set("price")} type="number" /></div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, padding: "10px", background: C.card2, borderRadius: 8 }}>
              <input type="checkbox" id="cb-free" checked={form.free} onChange={setChk("free")} style={{ width: 18, height: 18 }} />
              <label htmlFor="cb-free" style={{ fontSize: 14, color: C.txt, cursor: "pointer" }}>🆓 Үнэгүй кино</label>
            </div>
            <label style={{ ...lbl, marginTop: 12 }}>Видео URL (YouTube / MP4 / Google Drive)</label>
            <input style={inputSt} value={form.url} onChange={set("url")} placeholder="https://youtu.be/... эсвэл .mp4 холбоос" />
            <label style={{ ...lbl, marginTop: 10 }}>Зургийн URL эсвэл файл</label>
            <input style={inputSt} value={form.img} onChange={set("img")} placeholder="https://..." />
            <input type="file" accept="image/*" onChange={(e: any) => {
              const file = e.target.files?.[0]; if (!file) return;
              const reader = new FileReader();
              reader.onload = (ev: any) => setForm((f: any) => ({ ...f, img: ev.target.result }));
              reader.readAsDataURL(file);
            }} style={{ marginTop: 6, fontSize: 12, color: C.muted, width: "100%" }} />
            <button onClick={save} disabled={saving} style={{ ...goldBtn, marginTop: 16, opacity: saving ? 0.6 : 1 }}>
              {saving ? "Хадгалж байна..." : "✅ Хадгалах"}
            </button>
          </div>
        </div>
      )}

      {tab === "list" && (
        <div style={{ padding: "0 14px" }}>
          {films.map((f: any) => (
            <div key={f.id} style={{ background: C.card, border: `0.5px solid ${C.bd}`, borderRadius: 12, padding: 12, marginBottom: 10 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                <div style={{ width: 44, height: 60, borderRadius: 6, background: f.bg || "#1a0820", flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {f.img ? <img src={f.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 20 }}>🎬</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.txt, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.title}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{f.badge} · {f.free ? "Үнэгүй" : `${f.price?.toLocaleString()}₮`} · {f.views} үзсэн</div>
                  <div style={{ fontSize: 11, marginTop: 2, color: f.locked ? C.red : C.green }}>{f.locked ? "🔒 Хаалттай" : "🔓 Нээлттэй"}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => toggleLock(f)} style={{ flex: 1, padding: "8px 4px", borderRadius: 8, border: `0.5px solid ${C.bd}`, background: f.locked ? "#166534" : "#7f1d1d", color: f.locked ? "#4ade80" : "#f87171", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  {f.locked ? "🔓 Нээх" : "🔒 Хаах"}
                </button>
                <button onClick={() => setEditId(editId === f.id ? null : f.id)} style={{ flex: 1, padding: "8px 4px", borderRadius: 8, border: `0.5px solid ${C.bd}`, background: C.card2, color: C.muted, fontSize: 12, cursor: "pointer" }}>✏️ Засах</button>
                <button onClick={() => deletFilm(f.id)} style={{ padding: "8px 12px", borderRadius: 8, border: `0.5px solid #3a1a1a`, background: "#1a0a0a", color: "#f05555", fontSize: 12, cursor: "pointer" }}>🗑️</button>
              </div>
              {editId === f.id && (
                <div style={{ marginTop: 10, borderTop: `0.5px solid ${C.bd}`, paddingTop: 10 }}>
                  <label style={lbl}>Зургийн URL эсвэл файл</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input defaultValue={f.img} onChange={(e: any) => setImgVal(e.target.value)} style={{ ...inputSt, flex: 1 }} placeholder="https://..." />
                    <button onClick={() => updateImg(f.id, imgVal)} style={{ background: C.gold, border: "none", borderRadius: 8, padding: "0 12px", fontWeight: 700, cursor: "pointer", color: "#000", fontSize: 12 }}>OK</button>
                  </div>
                  <input type="file" accept="image/*" onChange={(e: any) => {
                    const file = e.target.files?.[0]; if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev: any) => { setImgVal(ev.target.result as string); updateImg(f.id, ev.target.result as string); };
                    reader.readAsDataURL(file);
                  }} style={{ marginTop: 4, fontSize: 12, color: C.muted, width: "100%" }} />
                  <label style={{ ...lbl, marginTop: 8 }}>Видео URL</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input defaultValue={f.url} onChange={(e: any) => setUrlVal(e.target.value)} style={{ ...inputSt, flex: 1 }} placeholder="https://youtu.be/..." />
                    <button onClick={() => updateUrl(f.id, urlVal)} style={{ background: C.gold, border: "none", borderRadius: 8, padding: "0 12px", fontWeight: 700, cursor: "pointer", color: "#000", fontSize: 12 }}>OK</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [page, setPage] = useState("home");
  const [films, setFilms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [payFilm, setPayFilm] = useState<any>(null);
  const [curFilm, setCurFilm] = useState<any>(null);
  const [showContact, setShowContact] = useState(false);
  const [user, setUser] = useState<any>(null);
  // { filmId: expiresAt (ms) } эсвэл monthly expiresAt
  const [accessMap, setAccessMap] = useState<Record<string, number>>({});

  useEffect(() => {
    const s = loadSession(); if (s) setUser(s);
    // localStorage-с access map уншина
    try { const a = JSON.parse(localStorage.getItem("kino_access") || "{}"); setAccessMap(a); } catch {}
  }, []);

  const saveAccess = (key: string, ms: number) => {
    setAccessMap(prev => {
      const next = { ...prev, [key]: ms };
      localStorage.setItem("kino_access", JSON.stringify(next));
      return next;
    });
  };

  const hasAccess = (filmId: number): boolean => {
    const now = Date.now();
    if (accessMap["monthly"] && accessMap["monthly"] > now) return true;
    if (accessMap[`film_${filmId}`] && accessMap[`film_${filmId}`] > now) return true;
    return false;
  };

  const loadFilms = async () => {
    setLoading(true);
    const data = await dbFetch("films?order=created_at.desc&select=*");
    setFilms(Array.isArray(data) ? data : []);
    setLoading(false);
  };
  useEffect(() => { loadFilms(); }, []);

  const handleFilm = (f: any) => {
    if (f.free || !f.locked || hasAccess(f.id)) { setCurFilm({ ...f, locked: false }); setPage("video"); }
    else setPayFilm(f);
  };

  const handlePaid = () => {
    const expires = Date.now() + 72 * 60 * 60 * 1000; // 72 цаг
    if (payFilm.monthly) {
      saveAccess("monthly", Date.now() + 30 * 24 * 60 * 60 * 1000);
    } else {
      saveAccess(`film_${payFilm.id}`, expires);
    }
    // DB-д expires_at шинэчлэх
    dbFetch(`pending_payments?ref_code=eq.${payFilm._lastRef || ""}`, {
      method: "PATCH",
      body: JSON.stringify({ expires_at: new Date(expires).toISOString() }),
    }).catch(() => {});
    setCurFilm({ ...payFilm, locked: false });
    setPayFilm(null);
    setPage("video");
  };

  const handleLogin = (u: any) => { setUser(u); setPage("home"); };
  const handleLogout = () => { clearSession(); setUser(null); };
  const filmsWithUnlock = films.map(f => hasAccess(f.id) ? { ...f, locked: false } : f);

  return (
    <div style={{ maxWidth: 430, margin: "0 auto", fontFamily: "system-ui,sans-serif", background: C.bg }}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}html,body{background:#0d0d14}input,select,button,textarea{font-family:inherit}input:focus,select:focus,textarea:focus{outline:none;border-color:#e8a020!important}::-webkit-scrollbar{width:0}`}</style>
      {page === "home" && <HomePage films={filmsWithUnlock} onFilm={handleFilm} onSearch={() => setPage("search")} onAdmin={() => setPage("adminlogin")} loading={loading} user={user} onLogin={() => setPage("login")} onLogout={handleLogout} onMonthly={() => setPayFilm({ id: 0, title: "1 Сарын багц", price: 11500, monthly: true, locked: true })} onContact={() => setShowContact(true)} />}
      {page === "login" && <LoginPage onLogin={handleLogin} onBack={() => setPage("home")} />}
      {page === "video" && curFilm && <VideoPage film={curFilm} onBack={() => setPage("home")} />}
      {page === "search" && <SearchPage films={filmsWithUnlock} onFilm={handleFilm} onBack={() => setPage("home")} />}
      {page === "adminlogin" && <AdminLogin onEnter={() => { setAdminAuth(true); setPage("admin"); }} onBack={() => setPage("home")} />}
      {page === "admin" && adminAuth && <AdminPage films={films} onBack={() => setPage("home")} onRefresh={loadFilms} />}
      {payFilm && <BankModal film={payFilm} onClose={() => setPayFilm(null)} onPaid={handlePaid} user={user} />}
      {showContact && <ContactModal onClose={() => setShowContact(false)} user={user} />}
    </div>
  );
}
