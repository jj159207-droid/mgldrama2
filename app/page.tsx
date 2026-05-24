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
  ibn: "IBN11000500",
  name: "Т.Жаргалбаяр",
  shortNumber: "MN11000500",
};

function saveSession(user: any) { const s = { user, expires: Date.now() + 7 * 24 * 60 * 60 * 1000 }; localStorage.setItem("kino_session", JSON.stringify(s)); }
function loadSession() { try { const s = JSON.parse(localStorage.getItem("kino_session") || "{}"); if (s.user && s.expires > Date.now()) return s.user; localStorage.removeItem("kino_session"); } catch { } return null; }
function clearSession() { localStorage.removeItem("kino_session"); }
function genUserId(id: number) { return "#" + String(id).padStart(6, "0"); }

// Гүйлгээний утга үүсгэх
function genRef(filmId: number, monthly?: boolean): string {
  const rand = Math.floor(1000 + Math.random() * 9000);
  if (monthly) return `KNM${rand}`;
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
  const [refCode] = useState(() => genRef(film.id, film.monthly));
  const [copied, setCopied] = useState<string | null>(null);
  const [autoStatus, setAutoStatus] = useState<"waiting" | "checking" | "paid" | "timeout">("waiting");
  const [showSms, setShowSms] = useState(false);
  const [manualChecking, setManualChecking] = useState(false);
  const intervalRef = useRef<any>(null);
  const timeoutRef = useRef<any>(null);

  const copyText = (text: string, key: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(key); setTimeout(() => setCopied(null), 2000);
        }).catch(() => {
          fallbackCopy(text, key);
        });
      } else {
        fallbackCopy(text, key);
      }
    } catch { fallbackCopy(text, key); }
  };

  const fallbackCopy = (text: string, key: string) => {
    const el = document.createElement("textarea");
    el.value = text; el.style.position = "fixed"; el.style.opacity = "0";
    document.body.appendChild(el); el.focus(); el.select();
    try { document.execCommand("copy"); setCopied(key); setTimeout(() => setCopied(null), 2000); } catch {}
    document.body.removeChild(el);
  };

  // Төлбөр үүсгэх + автомат polling эхлүүлэх
  useEffect(() => {
    // Буцах товч дарахад сайтаас гарахгүй байлгах
    window.history.pushState({ modal: true }, "");
    const handlePop = () => {
      window.history.pushState({ modal: true }, "");
      onClose();
    };
    window.addEventListener("popstate", handlePop);

    if (step !== "waiting") return () => window.removeEventListener("popstate", handlePop);

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
      window.removeEventListener("popstate", handlePop);
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
            <div style={{ fontSize: 36, fontWeight: 900, color: film.monthly ? "#a855f7" : C.gold }}>{film.price?.toLocaleString()}₮</div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{film.monthly ? "1 сарын хязгааргүй эрх" : "дараах данс руу шилжүүлнэ үү"}</div>
          </div>

          {/* Дансны мэдээлэл */}
          <div style={{ background: "#050d1a", border: `1.5px solid ${C.gold}`, borderRadius: 14, padding: "16px 18px", marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 12, letterSpacing: "0.08em", textTransform: "uppercase" }}>🏦 Дансны мэдээлэл</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: C.muted }}>Банк</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.txt }}>{BANK_ACCOUNT.bank}</span>
            </div>
            {/* IBN дугаар */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: C.muted }}>IBN</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.txt, fontFamily: "monospace" }}>{BANK_ACCOUNT.ibn}</span>
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
          <div onClick={() => copyText(refCode, "ref")} style={{ background: copied === "ref" ? "#052e16" : "#1a0a00", border: `3px solid ${copied === "ref" ? C.green : "#f97316"}`, borderRadius: 16, padding: "20px 16px", marginBottom: 14, textAlign: "center", cursor: "pointer", transition: "all 0.2s", boxShadow: copied === "ref" ? "none" : "0 0 20px #f9731640" }}>
            <div style={{ fontSize: 13, color: copied === "ref" ? C.green : "#f97316", marginBottom: 10, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 800 }}>
              {copied === "ref" ? "✅ Хуулагдлаа!" : "⚠️ ЗӨВХӨН ЭНЭ КОДЫГ ГҮЙЛГЭЭНИЙ УТГА ДЭЭР БИЧНЭ!"}
            </div>
            <div style={{ fontSize: 42, fontWeight: 900, color: copied === "ref" ? C.green : "#fb923c", letterSpacing: "0.25em", fontFamily: "monospace", marginBottom: 12 }}>
              {refCode}
            </div>
            <div style={{ background: copied === "ref" ? "#166534" : "#f97316", borderRadius: 10, padding: "10px 20px", display: "inline-block" }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>
                {copied === "ref" ? "✓ Хуулагдлаа" : "👆 ДАРЖ ХУУЛАХ"}
              </span>
            </div>
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

function FilmCard({ film, onClick, expiry }: any) {
  return (
    <div onClick={onClick} style={{ background: C.card, borderRadius: 12, overflow: "hidden", cursor: "pointer", border: `0.5px solid ${expiry ? C.green : C.bd}`, WebkitTapHighlightColor: "transparent" }}>
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
        {!film.free && film.locked && !expiry && (
          <div style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(0,0,0,0.6)", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 16 }}>🔒</span>
          </div>
        )}
        {expiry && (
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(22,163,74,0.85)", padding: "4px 6px", textAlign: "center" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#fff" }}>{expiry}</span>
          </div>
        )}
      </div>
      <div style={{ padding: "7px 8px 10px" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.txt, lineHeight: 1.3, marginBottom: 5 }}>{film.title}</div>
        {!film.free && <div style={{ fontSize: 10, color: C.muted, textDecoration: "line-through", marginBottom: 1 }}>{film.op?.toLocaleString()}₮</div>}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: film.free ? C.green : expiry ? C.green : C.gold }}>
            {film.free ? "Үнэгүй" : expiry ? "Нээлттэй" : `${film.price?.toLocaleString()}₮`}
          </span>
          {film.free || expiry
            ? <button style={{ background: C.green, border: "none", color: "#fff", borderRadius: 16, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>▶ Үзэх</button>
            : <button style={{ background: C.gold, border: "none", color: "#000", borderRadius: 16, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>💳</button>
          }
        </div>
      </div>
    </div>
  );
}

function ContactModal({ onClose, user }: any) {
  const [msgs, setMsgs] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<any>(null);

  const load = async () => {
    if (!user?.id) { setLoading(false); return; }
    const data = await dbFetch(`contact_messages?user_id=eq.${user.id}&order=created_at.asc&select=*`);
    setMsgs(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const send = async () => {
    if (!msg.trim()) return;
    setSending(true);
    const newMsg = { phone: user?.phone || "—", message: msg.trim(), user_id: user?.id || null, read: false };
    await dbFetch("contact_messages", { method: "POST", body: JSON.stringify(newMsg) });
    setMsg("");
    await load();
    setSending(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: C.bg, zIndex: 300, display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ background: C.card, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `0.5px solid ${C.bd}`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, fontSize: 22, cursor: "pointer" }}>←</button>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.txt }}>💬 Админтай холбогдох</div>
            <div style={{ fontSize: 11, color: C.green }}>● Онлайн</div>
          </div>
        </div>
      </div>

      {/* Чатын мессежүүд */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
        {loading ? (
          <div style={{ textAlign: "center", color: C.muted, marginTop: 40 }}>Ачааллаж байна...</div>
        ) : msgs.length === 0 ? (
          <div style={{ textAlign: "center", color: C.muted, marginTop: 40, fontSize: 13 }}>Асуулт, санал хүсэлтээ бичнэ үү</div>
        ) : (
          msgs.map(m => (
            <div key={m.id}>
              {/* Хэрэглэгчийн мессеж — баруун тал */}
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
                <div style={{ background: C.blue, borderRadius: "16px 16px 4px 16px", padding: "10px 14px", maxWidth: "75%", fontSize: 14, color: "#fff" }}>
                  {m.message}
                </div>
              </div>
              {/* Админы хариу — зүүн тал */}
              {m.reply && (
                <div style={{ display: "flex", justifyContent: "flex-start", marginTop: 4 }}>
                  <div style={{ background: C.card2, borderRadius: "16px 16px 16px 4px", padding: "10px 14px", maxWidth: "75%", fontSize: 14, color: C.txt, border: `0.5px solid ${C.bd}` }}>
                    <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>Админ</div>
                    {m.reply}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Мессеж бичих хэсэг */}
      <div style={{ background: C.card, borderTop: `0.5px solid ${C.bd}`, padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-end", flexShrink: 0 }}>
        <textarea
          value={msg}
          onChange={(e: any) => setMsg(e.target.value)}
          onKeyDown={(e: any) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Мессеж бичнэ үү..."
          style={{ ...inputSt, flex: 1, height: 44, resize: "none", lineHeight: 1.5, borderRadius: 22, padding: "11px 16px" }}
        />
        <button onClick={send} disabled={sending || !msg.trim()}
          style={{ background: msg.trim() ? C.blue : C.card2, border: "none", borderRadius: "50%", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, fontSize: 18 }}>
          ➤
        </button>
      </div>
    </div>
  );
}

function LoginPage({ onLogin, onBack }: any) {
  const [step, setStep] = useState<"phone" | "pin">("phone");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [isNewUser, setIsNewUser] = useState(false);
  const [pin2, setPin2] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const pinRefs = [useRef<any>(null), useRef<any>(null), useRef<any>(null), useRef<any>(null)];
  const pin2Refs = [useRef<any>(null), useRef<any>(null), useRef<any>(null), useRef<any>(null)];

  const handlePhoneContinue = async () => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length !== 8) { setErr("8 оронтой утасны дугаар оруулна уу"); return; }
    setLoading(true); setErr("");
    const exists = await dbFetch(`users?phone=eq.${cleaned}&select=id`);
    setIsNewUser(!(Array.isArray(exists) && exists.length > 0));
    setLoading(false);
    setPin(""); setPin2("");
    setStep("pin");
    setTimeout(() => pinRefs[0]?.current?.focus(), 100);
  };

  const handlePinSubmit = async () => {
    if (pin.length !== 4) { setErr("4 оронтой PIN оруулна уу"); return; }
    if (isNewUser && pin !== pin2) { setErr("PIN таарахгүй байна"); return; }
    setLoading(true); setErr("");
    const cleaned = phone.replace(/\D/g, "");
    if (isNewUser) {
      const data = await dbFetch("users", {
        method: "POST",
        body: JSON.stringify({ phone: cleaned, pin, user_id: "tmp", failed_attempts: 0 }),
      });
      if (data?.[0]?.id) {
        const uid = genUserId(data[0].id);
        await dbFetch(`users?id=eq.${data[0].id}`, { method: "PATCH", body: JSON.stringify({ user_id: uid }) });
        saveSession({ ...data[0], user_id: uid });
        onLogin({ ...data[0], user_id: uid });
      } else { setErr("Бүртгэл амжилтгүй. Дахин оролдоно уу"); }
    } else {
      const data = await dbFetch(`users?phone=eq.${cleaned}&select=*`);
      if (!Array.isArray(data) || data.length === 0) { setErr("Бүртгэлгүй дугаар"); setLoading(false); return; }
      const user = data[0];
      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        setErr("Хэт олон удаа буруу оруулсан. 15 минут хүлээнэ үү");
        setLoading(false); return;
      }
      if (user.pin !== pin) {
        const attempts = (user.failed_attempts || 0) + 1;
        const locked = attempts >= 3 ? { locked_until: new Date(Date.now() + 15 * 60 * 1000).toISOString() } : {};
        await dbFetch(`users?id=eq.${user.id}`, { method: "PATCH", body: JSON.stringify({ failed_attempts: attempts, ...locked }) });
        setErr(attempts >= 3 ? "3 удаа буруу оруулсан. 15 минут хүлээнэ үү" : `PIN буруу (${3 - attempts} оролдлого үлдсэн)`);
        setPin("");
        setTimeout(() => pinRefs[0]?.current?.focus(), 100);
        setLoading(false); return;
      }
      await dbFetch(`users?id=eq.${user.id}`, { method: "PATCH", body: JSON.stringify({ failed_attempts: 0, locked_until: null }) });
      saveSession(user);
      onLogin(user);
    }
    setLoading(false);
  };

  const handlePinKey = (e: any, i: number, val: string, setVal: (v: string) => void, refs: any[]) => {
    if (e.key === "Backspace") {
      if (val[i]) { setVal(val.slice(0, i) + val.slice(i + 1)); }
      else if (i > 0) { setVal(val.slice(0, i - 1) + val.slice(i)); refs[i - 1]?.current?.focus(); }
      setErr("");
    } else if (e.key === "Enter" && pin.length === 4) { handlePinSubmit(); }
  };

  const handlePinChange = (e: any, i: number, val: string, setVal: (v: string) => void, refs: any[]) => {
    const digit = e.target.value.replace(/\D/g, "").slice(-1);
    if (!digit) return;
    const next = (val.slice(0, i) + digit + val.slice(i + 1)).slice(0, 4);
    setVal(next); setErr("");
    if (i < 3) refs[i + 1]?.current?.focus();
  };

  const PinBoxes = ({ val, setVal, refs }: { val: string; setVal: (v: string) => void; refs: any[] }) => (
    <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 20 }}>
      {[0, 1, 2, 3].map(i => (
        <input
          key={i}
          ref={refs[i]}
          type="password"
          inputMode="numeric"
          maxLength={1}
          value={val[i] || ""}
          onChange={(e: any) => handlePinChange(e, i, val, setVal, refs)}
          onKeyDown={(e: any) => handlePinKey(e, i, val, setVal, refs)}
          style={{
            width: 58, height: 58, textAlign: "center", fontSize: 24, fontWeight: 800,
            background: val[i] ? "#1a1a2e" : "#0a0a14",
            border: `2px solid ${err ? C.red : val[i] ? C.blue : C.bd}`,
            borderRadius: 14, color: C.txt, outline: "none", caretColor: "transparent",
            transition: "border-color 0.2s, background 0.2s",
          }}
        />
      ))}
    </div>
  );

  if (step === "phone") {
    return (
      <div style={{ background: C.bg, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", borderBottom: `0.5px solid ${C.bd}` }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: C.muted, fontSize: 22, cursor: "pointer", marginRight: 10 }}>←</button>
          <span style={{ fontSize: 16, fontWeight: 700, color: C.txt }}>Утасаар нэвтрэх</span>
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "24px 16px" }}>
          <div style={{ width: "100%", maxWidth: 400, background: "#0e0e1a", borderRadius: 20, padding: "28px 22px", border: `0.5px solid ${C.bd}` }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.txt, marginBottom: 8 }}>Утасаар нэвтрэх</div>
            <div style={{ fontSize: 14, color: C.muted, marginBottom: 20 }}>Монгол утасны дугаараа оруулна уу.</div>
            <label style={{ ...lbl, fontSize: 13, marginBottom: 8 }}>Утас (8XXXXXXXX)</label>
            <input
              style={{ ...inputSt, fontSize: 22, fontWeight: 700, textAlign: "center", letterSpacing: "0.15em", padding: "14px", borderRadius: 12, border: `1.5px solid ${C.blue}`, background: "#0a0a14" }}
              value={phone}
              onChange={(e: any) => { setPhone(e.target.value.replace(/\D/g, "").slice(0, 8)); setErr(""); }}
              placeholder="88123456"
              type="tel"
              inputMode="numeric"
              maxLength={8}
              autoFocus
              onKeyDown={(e: any) => e.key === "Enter" && handlePhoneContinue()}
            />
            {err && <div style={{ color: C.red, fontSize: 12, marginTop: 8, textAlign: "center" }}>{err}</div>}
            <button
              onClick={handlePhoneContinue}
              disabled={loading || phone.replace(/\D/g, "").length !== 8}
              style={{ ...goldBtn, marginTop: 16, fontSize: 16, padding: 15, borderRadius: 12, opacity: loading || phone.replace(/\D/g, "").length !== 8 ? 0.6 : 1 }}
            >
              {loading ? "Шалгаж байна..." : "Үргэлжлүүлэх"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: C.bg, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", borderBottom: `0.5px solid ${C.bd}` }}>
        <button onClick={() => { setStep("phone"); setErr(""); setPin(""); setPin2(""); }} style={{ background: "none", border: "none", color: C.muted, fontSize: 22, cursor: "pointer", marginRight: 10 }}>←</button>
        <span style={{ fontSize: 16, fontWeight: 700, color: C.txt }}>Утасаар нэвтрэх</span>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "24px 16px" }}>
        <div style={{ width: "100%", maxWidth: 400, background: "#0e0e1a", borderRadius: 20, padding: "28px 22px", border: `0.5px solid ${C.bd}` }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.txt, marginBottom: 16 }}>Утасаар нэвтрэх</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 13, color: C.muted }}>Утас</span>
            <button onClick={() => { setStep("phone"); setPin(""); setPin2(""); setErr(""); }} style={{ background: "none", border: "none", color: C.blue, fontSize: 13, cursor: "pointer", fontWeight: 600 }}>← Өөрчлөх</button>
          </div>
          <div style={{ background: "#0a0a14", borderRadius: 12, padding: "13px", textAlign: "center", fontSize: 20, fontWeight: 800, color: C.txt, letterSpacing: "0.15em", marginBottom: 20, border: `0.5px solid ${C.bd}` }}>
            {phone}
          </div>
          <label style={{ ...lbl, fontSize: 13, textAlign: "center", display: "block", marginBottom: 14 }}>
            {isNewUser ? "Шинэ PIN код тохируулна уу" : "PIN код оруулна уу"}
          </label>
          <PinBoxes val={pin} setVal={setPin} refs={pinRefs} />
          {isNewUser && (
            <>
              <label style={{ ...lbl, fontSize: 13, textAlign: "center", display: "block", marginBottom: 14 }}>PIN давтан оруулна уу</label>
              <PinBoxes val={pin2} setVal={setPin2} refs={pin2Refs} />
            </>
          )}
          {err && <div style={{ color: C.red, fontSize: 12, marginBottom: 10, textAlign: "center" }}>{err}</div>}
          <button
            onClick={handlePinSubmit}
            disabled={loading || pin.length !== 4 || (isNewUser && pin2.length !== 4)}
            style={{ ...goldBtn, fontSize: 16, padding: 15, borderRadius: 12, opacity: loading || pin.length !== 4 || (isNewUser && pin2.length !== 4) ? 0.6 : 1 }}
          >
            {loading ? "Түр хүлээнэ үү..." : isNewUser ? "✅ Бүртгүүлэх" : "🔓 Нэвтрэх"}
          </button>
          {!isNewUser && (
            <button
              onClick={async () => {
                const cleaned = phone.replace(/\D/g, "");
                const data = await dbFetch(`users?phone=eq.${cleaned}&select=id`);
                if (Array.isArray(data) && data.length > 0) {
                  const newPin = prompt("Шинэ 4 оронтой PIN оруулна уу:");
                  if (newPin && /^\d{4}$/.test(newPin)) {
                    await dbFetch(`users?id=eq.${data[0].id}`, { method: "PATCH", body: JSON.stringify({ pin: newPin, failed_attempts: 0, locked_until: null }) });
                    alert("PIN амжилттай солигдлоо!"); setPin("");
                    setTimeout(() => pinRefs[0]?.current?.focus(), 100);
                  }
                }
              }}
              style={{ width: "100%", background: "none", border: "none", color: C.blue, fontSize: 13, cursor: "pointer", marginTop: 14, textAlign: "center" }}
            >
              PIN код мартсан
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function HomePage({ films, onFilm, onSearch, onAdmin, loading, user, onLogin, onLogout, onMonthly, onContact, accessMap, onInstall }: any) {
  const tapRef = useRef<{ count: number; timer: any }>({ count: 0, timer: null });

  const handleLogoTap = () => {
    tapRef.current.count += 1;
    if (tapRef.current.timer) clearTimeout(tapRef.current.timer);
    if (tapRef.current.count >= 4) {
      tapRef.current.count = 0;
      onAdmin();
    } else {
      tapRef.current.timer = setTimeout(() => { tapRef.current.count = 0; }, 3000);
    }
  };
  const getExpiry = (filmId: number): string | null => {
    if (!user) return null;
    const now = Date.now();
    if (accessMap?.["monthly"] && accessMap["monthly"] > now) {
      const h = Math.ceil((accessMap["monthly"] - now) / 3600000);
      return h > 24 ? `👑 ${Math.ceil(h/24)} хоног үлдсэн` : `👑 ${h}ц үлдсэн`;
    }
    const key = `film_${filmId}`;
    if (accessMap?.[key] && accessMap[key] > now) {
      const h = Math.ceil((accessMap[key] - now) / 3600000);
      return h > 1 ? `🕐 ${h}ц үлдсэн` : "🕐 <1ц үлдсэн";
    }
    return null;
  };
  return (
    <div style={{ background: C.bg, minHeight: "100vh", paddingBottom: 20 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", background: C.bg, position: "sticky", top: 0, zIndex: 10, borderBottom: `0.5px solid ${C.bd}` }}>
        <a href="https://m.me/61590383810997" target="_blank" rel="noopener noreferrer" style={{ background: "none", border: `0.5px solid #1877f2`, borderRadius: 16, padding: "5px 10px", fontSize: 11, fontWeight: 700, color: "#1877f2", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
          💬 Messenger
        </a>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={onSearch} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 20 }}>🔍</button>
          {user
            ? <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12, color: C.gold, fontWeight: 700 }}>{user.phone}</span>
                <button onClick={onLogout} style={{ background: C.card2, border: `0.5px solid ${C.bd}`, color: C.muted, cursor: "pointer", fontSize: 11, borderRadius: 8, padding: "5px 8px" }}>Гарах</button>
              </div>
            : <button onClick={onLogin} style={{ background: C.gold, border: "none", color: "#000", cursor: "pointer", fontSize: 12, borderRadius: 8, padding: "6px 10px", fontWeight: 700 }}>Нэвтрэх</button>
          }
          <button onClick={onContact} style={{ background: C.card2, border: `0.5px solid ${C.bd}`, color: C.muted, cursor: "pointer", fontSize: 12, borderRadius: 8, padding: "6px 10px" }}>💬</button>
          <button onClick={handleLogoTap} style={{ background: C.card2, border: `0.5px solid ${C.bd}`, color: C.muted, cursor: "pointer", fontSize: 12, borderRadius: 8, padding: "6px 10px" }}>⚙️</button>
          
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, padding: "12px 16px 8px" }}>
        <div onClick={onLogin} style={{ background: "linear-gradient(90deg,#0369a1,#0ea5e9)", borderRadius: 14, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
          <span style={{ fontSize: 26 }}>🎬</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>Нэвтрэх / Бүртгүүлэх</div>
            <div style={{ fontSize: 13, color: "#bae6fd" }}>Киногоо үзэхийн тулд нэвтэрнэ үү</div>
          </div>
        </div>
        <div onClick={onMonthly} style={{ background: "linear-gradient(90deg,#7c3aed,#a855f7)", borderRadius: 14, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 26 }}>👑</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>1 Сарын багц</div>
              <div style={{ fontSize: 12, color: "#e9d5ff" }}>Бүх кино — хязгааргүй үзэх</div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#fff" }}>14,500₮</div>
            <div style={{ fontSize: 11, color: "#e9d5ff" }}>/ сар</div>
          </div>
        </div>
      </div>
      <div style={{ padding: "4px 20px 8px" }}>
      </div>
      {loading
        ? <div style={{ textAlign: "center", padding: 40, color: C.muted }}>Ачааллаж байна...</div>
        : <div className="film-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: "0 10px" }}>
          {films.map((f: any) => <FilmCard key={f.id} film={f} onClick={() => onFilm(f)} expiry={getExpiry(f.id)} />)}
        </div>
      }
      </div>
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
    // 2 pushState хийнэ — нэг буцахад video дотор үлдэнэ, хоёр дахинд нь гарна
    window.history.pushState({ video: true }, "");
    window.history.pushState({ video: true }, "");
    const handlePop = () => {
      // Дахин нэг pushState нэмж буцах дарахад сайтаас гарахгүй болгоно
      window.history.pushState({ video: true }, "");
      onBack();
    };
    window.addEventListener("popstate", handlePop);
    return () => { 
      clearTimeout(t); 
      window.removeEventListener("popstate", handlePop);
    };
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
  const [filter, setFilter] = useState<"all" | "pending" | "confirmed" | "revoked" | "monthly">("all");

  const load = async () => {
    setLoading(true);
    const [pend, fl, us] = await Promise.all([
      dbFetch("pending_payments?order=created_at.desc&limit=100&select=*"),
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

  const revokeOrder = async (ref_code: string) => {
    if (!window.confirm("Эрхийг хасах уу?")) return;
    await dbFetch(`pending_payments?ref_code=eq.${ref_code}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "revoked" }),
    });
    await load();
  };

  const deleteOrder = async (id: number) => {
    if (!window.confirm("Захиалгыг бүрмөсөн устгах уу?")) return;
    await dbFetch(`pending_payments?id=eq.${id}`, { method: "DELETE" });
    setOrders(os => os.filter(o => o.id !== id));
  };

  const getFilmTitle = (id: number) => id === 0 ? "👑 Сарын багц" : films.find((f: any) => f.id === id)?.title || `#${id}`;
  const getPhone = (uid: number) => uid ? (users.find((u: any) => u.id === uid)?.phone || "—") : "—";
  const statusColor = (s: string) => s === "confirmed" ? C.green : s === "pending" ? C.gold : C.red;
  const statusLabel = (s: string) => s === "confirmed" ? "✅ Баталгаажсан" : s === "revoked" ? "🚫 Хасагдсан" : "⏳ Хүлээгдэж байна";

  const filtered = orders.filter((o: any) => {
    if (filter === "all") return true;
    if (filter === "monthly") return o.plan === "monthly";
    return o.status === filter;
  });

  const totalRevenue = orders.filter(o => o.status === "confirmed").reduce((s, o) => s + (o.amount || 0), 0);
  const pendingCount = orders.filter(o => o.status === "pending").length;
  const confirmedCount = orders.filter(o => o.status === "confirmed").length;
  const monthlyCount = orders.filter(o => o.plan === "monthly" && o.status === "confirmed").length;

  const filters: { key: typeof filter; label: string }[] = [
    { key: "all", label: `Бүгд ${orders.length}` },
    { key: "pending", label: `⏳ ${pendingCount}` },
    { key: "confirmed", label: `✅ ${confirmedCount}` },
    { key: "monthly", label: `👑 ${monthlyCount}` },
    { key: "revoked", label: `🚫 Хасагдсан` },
  ];

  return (
    <div style={{ padding: "0 14px" }}>
      {/* Статистик */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        <div style={{ background: "#052e16", border: `0.5px solid ${C.green}`, borderRadius: 10, padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: C.muted }}>Нийт орлого</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.green }}>{totalRevenue.toLocaleString()}₮</div>
        </div>
        <div style={{ background: C.card2, border: `0.5px solid ${C.bd}`, borderRadius: 10, padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: C.muted }}>Хүлээгдэж байна</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.gold }}>{pendingCount} захиалга</div>
        </div>
      </div>

      {/* Filter товчнууд */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto", paddingBottom: 4 }}>
        {filters.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            style={{ flexShrink: 0, padding: "6px 12px", borderRadius: 8, border: "none", background: filter === f.key ? C.gold : C.card2, color: filter === f.key ? "#000" : C.muted, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            {f.label}
          </button>
        ))}
        <button onClick={load} style={{ flexShrink: 0, background: C.card2, border: `0.5px solid ${C.bd}`, borderRadius: 8, padding: "6px 12px", color: C.muted, fontSize: 12, cursor: "pointer" }}>🔄</button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: C.muted }}>Ачааллаж байна...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: C.muted }}>Захиалга байхгүй байна</div>
      ) : (
        filtered.map((o: any) => (
          <div key={o.id} style={{ background: C.card, border: `0.5px solid ${o.status === "pending" ? C.gold : o.status === "revoked" ? "#3a1a1a" : C.bd}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#fb923c", fontFamily: "monospace" }}>{o.ref_code}</div>
                <div style={{ fontSize: 12, color: C.txt, marginTop: 2 }}>{getFilmTitle(o.film_id)}</div>
                <div style={{ fontSize: 12, color: C.gold, marginTop: 2 }}>📞 {getPhone(o.user_id)}</div>
                {o.plan === "monthly" && <div style={{ fontSize: 11, color: "#a855f7", marginTop: 2 }}>👑 Сарын багц</div>}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.gold }}>{o.amount?.toLocaleString()}₮</div>
                <div style={{ fontSize: 11, color: statusColor(o.status), marginTop: 2 }}>{statusLabel(o.status)}</div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>
              {new Date(o.created_at).toLocaleString("mn-MN")}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {o.status === "pending" && (
                <button onClick={() => confirmOrder(o.ref_code)} disabled={confirming === o.ref_code}
                  style={{ flex: 1, background: confirming === o.ref_code ? C.card2 : "#166534", border: "none", borderRadius: 8, padding: "10px", color: confirming === o.ref_code ? C.muted : "#4ade80", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  {confirming === o.ref_code ? "..." : "✅ Баталгаажуулах"}
                </button>
              )}
              {o.status === "confirmed" && (
                <button onClick={() => revokeOrder(o.ref_code)}
                  style={{ flex: 1, background: "#1a0a0a", border: `0.5px solid ${C.red}`, borderRadius: 8, padding: "8px", color: C.red, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  🚫 Эрх хасах
                </button>
              )}
              {o.status === "revoked" && (
                <div style={{ flex: 1, fontSize: 12, color: C.red, textAlign: "center", padding: "8px" }}>🚫 Хасагдсан</div>
              )}
              <button onClick={() => deleteOrder(o.id)}
                style={{ background: "#1a0a0a", border: `0.5px solid #333`, borderRadius: 8, padding: "8px 12px", color: "#555", fontSize: 14, cursor: "pointer" }}>
                🗑️
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function AdminMembersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [films, setFilms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [userPayments, setUserPayments] = useState<any[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [showRights, setShowRights] = useState(false);

  const load = async () => {
    setLoading(true);
    const [us, fl] = await Promise.all([
      dbFetch("users?order=id.desc&select=*"),
      dbFetch("films?select=id,title"),
    ]);
    setUsers(Array.isArray(us) ? us : []);
    setFilms(Array.isArray(fl) ? fl : []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openUser = async (u: any) => {
    setSelected(u);
    setShowRights(false);
    setLoadingPayments(true);
    const payments = await dbFetch(`pending_payments?user_id=eq.${u.id}&order=created_at.desc&select=*`);
    setUserPayments(Array.isArray(payments) ? payments : []);
    setLoadingPayments(false);
  };

  const revokeAccess = async (ref_code: string) => {
    if (!window.confirm("Энэ эрхийг хасах уу?")) return;
    await dbFetch(`pending_payments?ref_code=eq.${ref_code}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "revoked" }),
    });
    setUserPayments(ps => ps.map(p => p.ref_code === ref_code ? { ...p, status: "revoked" } : p));
  };

  const deleteUser = async (id: number) => {
    if (!window.confirm("Хэрэглэгчийг устгах уу?")) return;
    await dbFetch(`users?id=eq.${id}`, { method: "DELETE" });
    setUsers(us => us.filter(u => u.id !== id));
    setSelected(null);
  };

  const getFilmName = (id: number) => id === 0 ? "👑 Сарын багц" : films.find(f => f.id === id)?.title || `Кино #${id}`;
  const statusColor = (s: string) => s === "confirmed" ? C.green : s === "revoked" ? C.red : C.gold;
  const statusLabel = (s: string) => s === "confirmed" ? "✅ Идэвхтэй" : s === "revoked" ? "🚫 Хасагдсан" : "⏳ Хүлээгдэж байна";
  const activePayments = userPayments.filter(p => p.status === "confirmed");

  if (selected) return (
    <div style={{ padding: "0 14px" }}>
      <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: C.muted, fontSize: 14, cursor: "pointer", marginBottom: 12 }}>← Буцах</button>
      
      {/* Гишүүний мэдээлэл */}
      <div style={{ background: C.card, border: `0.5px solid ${C.bd}`, borderRadius: 12, padding: 16, marginBottom: 14 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.gold, marginBottom: 4 }}>📞 {selected.phone}</div>
        <div style={{ fontSize: 12, color: C.muted }}>ID: {selected.user_id}</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Бүртгэгдсэн: {new Date(selected.created_at || Date.now()).toLocaleDateString("mn-MN")}</div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={() => setShowRights(!showRights)} style={{ flex: 1, background: showRights ? C.blue : C.card2, border: `0.5px solid ${C.blue}`, borderRadius: 8, padding: "9px", color: showRights ? "#fff" : C.blue, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            🎬 Кино үзэх эрх {loadingPayments ? "..." : `(${activePayments.length})`}
          </button>
          <button onClick={() => deleteUser(selected.id)} style={{ background: "#1a0a0a", border: `0.5px solid ${C.red}`, borderRadius: 8, padding: "9px 14px", color: C.red, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>🗑️</button>
        </div>
      </div>

      {/* Идэвхтэй эрхүүд */}
      {showRights && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.txt, marginBottom: 10 }}>
            🎬 Идэвхтэй кино эрхүүд
          </div>
          {loadingPayments ? (
            <div style={{ textAlign: "center", padding: 20, color: C.muted }}>Ачааллаж байна...</div>
          ) : activePayments.length === 0 ? (
            <div style={{ textAlign: "center", padding: 16, color: C.muted, background: C.card, borderRadius: 10 }}>Идэвхтэй эрх байхгүй</div>
          ) : activePayments.map(p => (
            <div key={p.id} style={{ background: C.card, border: `0.5px solid ${C.green}`, borderRadius: 12, padding: 14, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.txt }}>{getFilmName(p.film_id)}</div>
                <div style={{ fontSize: 11, color: C.green, marginTop: 2 }}>✅ Идэвхтэй · {p.amount?.toLocaleString()}₮</div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{new Date(p.created_at).toLocaleString("mn-MN")}</div>
              </div>
              <button onClick={() => revokeAccess(p.ref_code)} style={{ background: "#1a0a0a", border: `0.5px solid ${C.red}`, borderRadius: 8, padding: "8px 12px", color: C.red, fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                🚫 Хасах
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Бүх захиалгын түүх */}
      <div style={{ fontSize: 13, fontWeight: 700, color: C.txt, marginBottom: 10 }}>Захиалгын түүх</div>
      {loadingPayments ? (
        <div style={{ textAlign: "center", padding: 20, color: C.muted }}>Ачааллаж байна...</div>
      ) : userPayments.length === 0 ? (
        <div style={{ textAlign: "center", padding: 20, color: C.muted }}>Захиалга байхгүй</div>
      ) : userPayments.map(p => (
        <div key={p.id} style={{ background: C.card, border: `0.5px solid ${statusColor(p.status)}22`, borderRadius: 12, padding: 14, marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fb923c", fontFamily: "monospace" }}>{p.ref_code}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{getFilmName(p.film_id)}</div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{new Date(p.created_at).toLocaleString("mn-MN")}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.gold }}>{p.amount?.toLocaleString()}₮</div>
              <div style={{ fontSize: 11, color: statusColor(p.status), marginTop: 2 }}>{statusLabel(p.status)}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ padding: "0 14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: C.muted }}>{users.length} гишүүн</span>
        <button onClick={load} style={{ background: C.card2, border: `0.5px solid ${C.bd}`, borderRadius: 8, padding: "6px 12px", color: C.muted, fontSize: 12, cursor: "pointer" }}>🔄 Шинэчлэх</button>
      </div>
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: C.muted }}>Ачааллаж байна...</div>
      ) : users.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: C.muted }}>Гишүүн байхгүй байна</div>
      ) : (
        users.map(u => (
          <div key={u.id} onClick={() => openUser(u)} style={{ background: C.card, border: `0.5px solid ${C.bd}`, borderRadius: 12, padding: 14, marginBottom: 10, cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.gold }}>📞 {u.phone}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>ID: {u.user_id} · {new Date(u.created_at || Date.now()).toLocaleDateString("mn-MN")}</div>
              </div>
              <span style={{ color: C.muted, fontSize: 16 }}>›</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function AdminContactTab() {
  const [msgs, setMsgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyId, setReplyId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

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

  const sendReply = async (id: number) => {
    if (!replyText.trim()) return;
    setSending(true);
    await dbFetch(`contact_messages?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify({ reply: replyText.trim(), read: true }),
    });
    setMsgs(ms => ms.map(m => m.id === id ? { ...m, reply: replyText.trim(), read: true } : m));
    setReplyId(null);
    setReplyText("");
    setSending(false);
  };

  const deleteAll = async () => {
    if (!window.confirm("Бүх чатыг устгах уу?")) return;
    await dbFetch("contact_messages?id=gt.0", { method: "DELETE" });
    setMsgs([]);
  };

  const deleteOne = async (id: number) => {
    await dbFetch(`contact_messages?id=eq.${id}`, { method: "DELETE" });
    setMsgs(ms => ms.filter(m => m.id !== id));
  };

  return (
    <div style={{ padding: "0 14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: C.muted }}>{msgs.filter(m => !m.read).length} шинэ · {msgs.length} нийт</span>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={load} style={{ background: C.card2, border: `0.5px solid ${C.bd}`, borderRadius: 8, padding: "6px 12px", color: C.muted, fontSize: 12, cursor: "pointer" }}>🔄</button>
          <button onClick={deleteAll} style={{ background: "#1a0a0a", border: `0.5px solid ${C.red}`, borderRadius: 8, padding: "6px 12px", color: C.red, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>🗑️ Бүгдийг устгах</button>
        </div>
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
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {!m.read && <span style={{ fontSize: 11, background: C.gold, color: "#000", borderRadius: 6, padding: "2px 8px", fontWeight: 700 }}>Шинэ</span>}
                <button onClick={() => deleteOne(m.id)} style={{ background: "none", border: "none", color: C.red, fontSize: 14, cursor: "pointer" }}>🗑️</button>
              </div>
            </div>
            {/* Хэрэглэгчийн мессеж */}
            <div style={{ fontSize: 13, color: C.txt, background: C.card2, borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>{m.message}</div>
            {/* Хариу байвал харуулах */}
            {m.reply && (
              <div style={{ background: "#0a1628", border: `0.5px solid ${C.blue}`, borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
                <div style={{ fontSize: 10, color: C.blue, marginBottom: 4, fontWeight: 700 }}>АДМИНЫ ХАРИУ</div>
                <div style={{ fontSize: 13, color: C.txt }}>{m.reply}</div>
              </div>
            )}
            {/* Хариу бичих */}
            {replyId === m.id ? (
              <div>
                <textarea
                  value={replyText}
                  onChange={(e: any) => setReplyText(e.target.value)}
                  placeholder="Хариу бичнэ үү..."
                  style={{ ...inputSt, height: 80, resize: "none", lineHeight: 1.5, marginBottom: 8 }}
                  autoFocus
                />
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => sendReply(m.id)} disabled={sending || !replyText.trim()}
                    style={{ flex: 1, background: C.blue, border: "none", borderRadius: 8, padding: "9px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: sending ? 0.6 : 1 }}>
                    {sending ? "Илгээж байна..." : "📨 Хариу илгээх"}
                  </button>
                  <button onClick={() => { setReplyId(null); setReplyText(""); }}
                    style={{ background: C.card2, border: `0.5px solid ${C.bd}`, borderRadius: 8, padding: "9px 14px", color: C.muted, fontSize: 12, cursor: "pointer" }}>Цуцлах</button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => { setReplyId(m.id); setReplyText(""); }}
                  style={{ flex: 1, background: C.card2, border: `0.5px solid ${C.blue}`, borderRadius: 8, padding: "8px", color: C.blue, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  💬 {m.reply ? "Дахин хариулах" : "Хариулах"}
                </button>
                {!m.read && (
                  <button onClick={() => markRead(m.id)}
                    style={{ background: "#166534", border: "none", borderRadius: 8, padding: "8px 14px", color: "#4ade80", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    ✅ Уншсан
                  </button>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function EditFilmPanel({ f, onDone }: any) {
  const [title, setTitle] = useState(f.title);
  const [price, setPrice] = useState(String(f.price || 5000));
  const [op, setOp] = useState(String(f.op || 6000));
  const [url, setUrl] = useState(f.url || "");
  const [img, setImg] = useState(f.img || "");
  const [badge, setBadge] = useState(f.badge || "Хэлтэй");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await dbFetch(`films?id=eq.${f.id}`, {
      method: "PATCH",
      body: JSON.stringify({ title, price: parseInt(price) || 0, op: parseInt(op) || 0, url, img, badge }),
    });
    setSaving(false);
    onDone();
  };

  return (
    <div style={{ marginTop: 10, borderTop: `0.5px solid ${C.bd}`, paddingTop: 10 }}>
      <label style={lbl}>Гарчиг</label>
      <input style={inputSt} value={title} onChange={(e: any) => setTitle(e.target.value)} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
        <div>
          <label style={lbl}>Зарах үнэ ₮</label>
          <input style={inputSt} value={price} onChange={(e: any) => setPrice(e.target.value)} type="number" />
        </div>
        <div>
          <label style={lbl}>Хуучин үнэ ₮</label>
          <input style={inputSt} value={op} onChange={(e: any) => setOp(e.target.value)} type="number" />
        </div>
      </div>
      <label style={{ ...lbl, marginTop: 8 }}>Badge</label>
      <select style={inputSt} value={badge} onChange={(e: any) => setBadge(e.target.value)}>
        <option>Хэлтэй</option>
        <option>Хадмал</option>
      </select>
      <label style={{ ...lbl, marginTop: 8 }}>Видео URL</label>
      <input style={inputSt} value={url} onChange={(e: any) => setUrl(e.target.value)} placeholder="https://iframe.mediadelivery.net/..." />
      <label style={{ ...lbl, marginTop: 8 }}>Зургийн URL эсвэл файл</label>
      <input style={inputSt} value={img} onChange={(e: any) => setImg(e.target.value)} placeholder="https://..." />
      <input type="file" accept="image/*" onChange={(e: any) => {
        const file = e.target.files?.[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev: any) => setImg(ev.target.result as string);
        reader.readAsDataURL(file);
      }} style={{ marginTop: 4, fontSize: 12, color: C.muted, width: "100%" }} />
      {img && <img src={img} alt="" style={{ width: "100%", maxHeight: 120, objectFit: "cover", borderRadius: 8, marginTop: 6 }} />}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={save} disabled={saving} style={{ flex: 1, background: C.gold, border: "none", borderRadius: 8, padding: "10px", fontWeight: 700, cursor: "pointer", color: "#000", opacity: saving ? 0.6 : 1 }}>
          {saving ? "..." : "✅ Хадгалах"}
        </button>
        <button onClick={onDone} style={{ flex: 1, background: C.card2, border: `0.5px solid ${C.bd}`, borderRadius: 8, padding: "10px", color: C.muted, fontSize: 13, cursor: "pointer" }}>Болих</button>
      </div>
    </div>
  );
}

function AdminPage({ films, onBack, onRefresh }: any) {
  const [tab, setTab] = useState<"list" | "add" | "sms" | "orders" | "members">("list");
  const [editId, setEditId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [imgVal, setImgVal] = useState(""); const [urlVal, setUrlVal] = useState("");

  // Unread тоо ачааллах + 30 секунд тутамд шинэчлэх
  useEffect(() => {
    const fetchUnread = async () => {
      const data = await dbFetch("contact_messages?read=eq.false&select=id");
      setUnreadCount(Array.isArray(data) ? data.length : 0);
    };
    fetchUnread();
    const t = setInterval(fetchUnread, 30000);
    return () => clearInterval(t);
  }, [tab]);
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
      <div style={{ display: "flex", flexWrap: "wrap", padding: "10px 14px", gap: 6 }}>
        <button onClick={() => setTab("list")} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: tab === "list" ? C.gold : C.card2, color: tab === "list" ? "#000" : C.muted, fontWeight: 700, cursor: "pointer", fontSize: 11 }}>📋 Жагсаалт</button>
        <button onClick={() => setTab("orders")} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: tab === "orders" ? C.gold : C.card2, color: tab === "orders" ? "#000" : C.muted, fontWeight: 700, cursor: "pointer", fontSize: 11 }}>🧾 Захиалга</button>
        <button onClick={() => setTab("members")} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: tab === "members" ? C.gold : C.card2, color: tab === "members" ? "#000" : C.muted, fontWeight: 700, cursor: "pointer", fontSize: 11 }}>👥 Гишүүд</button>
        <button onClick={() => setTab("add")} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: tab === "add" ? C.gold : C.card2, color: tab === "add" ? "#000" : C.muted, fontWeight: 700, cursor: "pointer", fontSize: 11 }}>➕ Нэмэх</button>
        <button onClick={() => { setTab("sms"); setUnreadCount(0); }} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: tab === "sms" ? C.gold : C.card2, color: tab === "sms" ? "#000" : C.muted, fontWeight: 700, cursor: "pointer", fontSize: 11, position: "relative" }}>
          💬 Холбогдох
          {unreadCount > 0 && tab !== "sms" && (
            <span style={{ position: "absolute", top: 4, right: 4, background: C.red, color: "#fff", borderRadius: "50%", width: 18, height: 18, fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{unreadCount}</span>
          )}
        </button>
      </div>

      {tab === "orders" && <AdminOrdersTab />}
      {tab === "members" && <AdminMembersTab />}
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
                <EditFilmPanel f={f} onDone={() => { setEditId(null); onRefresh(); }} />
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
  const [adminAuth, setAdminAuth] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [showInstall, setShowInstall] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [pwaPrompt, setPwaPrompt] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [accessMap, setAccessMap] = useState<Record<string, number>>({});

  // PWA install prompt барих
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setPwaPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler as any);
    return () => window.removeEventListener('beforeinstallprompt', handler as any);
  }, []);

  const handleInstallClick = () => {
    if (pwaPrompt) {
      pwaPrompt.prompt();
      pwaPrompt.userChoice.then(() => setPwaPrompt(null));
    } else {
      setShowInstall(true);
    }
  };

  useEffect(() => {
    const s = loadSession(); if (s) { setUser(s); syncAccessFromDB(s.id); }
    // localStorage-с access map уншина
    try { const a = JSON.parse(localStorage.getItem("kino_access") || "{}"); setAccessMap(a); } catch {}
  }, []);

  // DB-с confirmed төлбөрүүдийг татаж access олгох
  const syncAccessFromDB = async (userId: number) => {
    // Бүх захиалгыг татах (confirmed + revoked)
    const payments = await dbFetch(
      `pending_payments?user_id=eq.${userId}&select=film_id,plan,created_at,status`
    );
    if (!Array.isArray(payments)) return;
    const now = Date.now();
    const newAccess: Record<string, number> = {};

    payments.forEach((p: any) => {
      if (p.status !== "confirmed") return; // revoked болон pending-г орхино
      if (p.plan === "monthly") {
        const exp = new Date(p.created_at).getTime() + 30 * 24 * 60 * 60 * 1000;
        if (exp > now) newAccess["monthly"] = exp;
      } else {
        const exp = new Date(p.created_at).getTime() + 72 * 60 * 60 * 1000;
        if (exp > now) newAccess[`film_${p.film_id}`] = Math.max(newAccess[`film_${p.film_id}`] || 0, exp);
      }
    });

    // localStorage-г бүрэн солих — revoked эрхүүд автоматаар арилна
    localStorage.setItem("kino_access", JSON.stringify(newAccess));
    setAccessMap(newAccess);
  };

  const saveAccess = (key: string, ms: number) => {
    setAccessMap(prev => {
      const next = { ...prev, [key]: ms };
      localStorage.setItem("kino_access", JSON.stringify(next));
      return next;
    });
  };

  const hasAccess = (filmId: number): boolean => {
    if (!user) return false;
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
    if (f.free) { setCurFilm({ ...f, locked: false }); setPage("video"); return; }
    if (!user) { setShowLoginPrompt(true); return; }
    if (!f.locked || hasAccess(f.id)) { setCurFilm({ ...f, locked: false }); setPage("video"); }
    else setPayFilm(f);
  };

  const handlePaid = () => {
    if (payFilm.monthly) {
      // 1 сарын эрх
      saveAccess("monthly", Date.now() + 30 * 24 * 60 * 60 * 1000);
      setPayFilm(null);
      // Бүх кино нээлттэй болно — нүүр хуудас руу буцах
      setPage("home");
    } else {
      // 72 цагийн эрх
      const expires = Date.now() + 72 * 60 * 60 * 1000;
      saveAccess(`film_${payFilm.id}`, expires);
      setCurFilm({ ...payFilm, locked: false });
      setPayFilm(null);
      setPage("video");
    }
  };

  const handleLogin = (u: any) => { setUser(u); syncAccessFromDB(u.id); setPage("home"); };
  const handleLogout = () => { clearSession(); setUser(null); };
  const filmsWithUnlock = films.map(f => hasAccess(f.id) ? { ...f, locked: false } : f);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "system-ui,sans-serif" }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#0d0d14}
        input,select,button,textarea{font-family:inherit}
        input:focus,select:focus,textarea:focus{outline:none;border-color:#e8a020!important}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:#0d0d14}
        ::-webkit-scrollbar-thumb{background:#1e1e2e;border-radius:4px}
        .film-grid{grid-template-columns:repeat(3,1fr)!important}
        @media(min-width:1100px){.film-grid{grid-template-columns:repeat(5,1fr)!important}}
        @media(max-width:600px){.film-grid{grid-template-columns:1fr 1fr!important}}
      `}</style>
      <script dangerouslySetInnerHTML={{ __html: `
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.register('/sw.js');
        }
        window.__pwaPrompt = null;
        window.__pwaClicked = false;
        window.addEventListener('beforeinstallprompt', function(e) {
          e.preventDefault();
          window.__pwaPrompt = e;
          if (window.__pwaClicked) {
            window.__pwaClicked = false;
            setTimeout(function() { e.prompt(); }, 100);
          }
        });
        window.addEventListener('appinstalled', function() {
          window.__pwaPrompt = null;
        });
      `}} />
      {page === "home" && <HomePage films={filmsWithUnlock} onFilm={handleFilm} onSearch={() => setPage("search")} onAdmin={() => setPage("adminlogin")} loading={loading} user={user} onLogin={() => setPage("login")} onLogout={handleLogout} onMonthly={() => setPayFilm({ id: 0, title: "1 Сарын багц", price: 14500, monthly: true, locked: true })} onContact={() => setShowContact(true)} accessMap={accessMap} onInstall={handleInstallClick} />}
      {page === "login" && <LoginPage onLogin={handleLogin} onBack={() => setPage("home")} />}
      {page === "video" && curFilm && <VideoPage film={curFilm} onBack={() => setPage("home")} />}
      {page === "search" && <SearchPage films={filmsWithUnlock} onFilm={handleFilm} onBack={() => setPage("home")} />}
      {page === "adminlogin" && <AdminLogin onEnter={() => { setAdminAuth(true); setPage("admin"); }} onBack={() => setPage("home")} />}
      {page === "admin" && adminAuth && <AdminPage films={films} onBack={() => setPage("home")} onRefresh={loadFilms} />}
      {payFilm && <BankModal film={payFilm} onClose={() => setPayFilm(null)} onPaid={handlePaid} user={user} />}
      {showContact && <ContactModal onClose={() => setShowContact(false)} user={user} />}
      {showInstall && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", display: "flex", alignItems: "flex-end", zIndex: 400 }}>
          <div style={{ background: C.card, borderRadius: "18px 18px 0 0", padding: "24px 20px 40px", width: "100%", border: `0.5px solid ${C.bd}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.txt }}>📲 Утсанд суулгах заавар</div>
              <button onClick={() => setShowInstall(false)} style={{ background: "none", border: "none", color: C.muted, fontSize: 24, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ background: C.card2, borderRadius: 12, padding: 16, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.gold, marginBottom: 10 }}>🤖 Android (Chrome)</div>
              <div style={{ fontSize: 13, color: C.txt, lineHeight: 1.8 }}>
                1. Chrome цэс <span style={{ color: C.gold, fontWeight: 700 }}>⋮</span> дарна<br/>
                2. <span style={{ color: C.gold, fontWeight: 700 }}>"Нүүр дэлгэцэнд нэмэх"</span> дарна<br/>
                3. <span style={{ color: C.gold, fontWeight: 700 }}>"Суулгах"</span> дарна
              </div>
            </div>
            <div style={{ background: C.card2, borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.blue, marginBottom: 10 }}>🍎 iPhone (Safari)</div>
              <div style={{ fontSize: 13, color: C.txt, lineHeight: 1.8 }}>
                1. Safari дээр нээнэ<br/>
                2. Share товч <span style={{ color: C.blue, fontWeight: 700 }}>□↑</span> дарна<br/>
                3. <span style={{ color: C.blue, fontWeight: 700 }}>"Add to Home Screen"</span> дарна
              </div>
            </div>
          </div>
        </div>
      )}
      {showLoginPrompt && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 24 }}>
          <div style={{ background: C.card, borderRadius: 18, padding: 28, width: "100%", maxWidth: 320, textAlign: "center", border: `0.5px solid ${C.bd}` }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔐</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: C.txt, marginBottom: 8 }}>Нэвтрэх шаардлагатай</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 24, lineHeight: 1.6 }}>Кино үзэхийн тулд бүртгүүлж эсвэл нэвтэрч орно уу</div>
            <button onClick={() => { setShowLoginPrompt(false); setPage("login"); }} style={{ ...goldBtn, marginBottom: 10 }}>🔓 Нэвтрэх / Бүртгүүлэх</button>
            <button onClick={() => setShowLoginPrompt(false)} style={{ width: "100%", background: "none", border: `0.5px solid ${C.bd}`, color: C.muted, padding: 11, borderRadius: 10, fontSize: 13, cursor: "pointer" }}>Буцах</button>
          </div>
        </div>
      )}
    </div>
  );
}
