"use client";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function dbFetch(path: string, opts?: RequestInit) {
  const { headers: extraHeaders, ...restOpts } = opts || {};
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...restOpts,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(extraHeaders as Record<string, string> || {}),
    },
  });
  return res.json();
}

const ADMIN_KEY = "admin2024";

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Ð”ÐÐÐ¡ÐÐ« ÐœÐ­Ð”Ð­Ð­Ð›Ð­Ð›
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const BANK_ACCOUNT = {
  bank: "Ð¥Ð°Ð°Ð½ Ð±Ð°Ð½Ðº",
  number: "5402504824",
  ibn: "IBN11000500",
  name: "Ð¢.Ð–Ð°Ñ€Ð³Ð°Ð»Ð±Ð°ÑÑ€",
  shortNumber: "MN11000500",
};

function saveSession(user: any) { const s = { user, expires: Date.now() + 7 * 24 * 60 * 60 * 1000 }; localStorage.setItem("kino_session", JSON.stringify(s)); }
function loadSession() { try { const s = JSON.parse(localStorage.getItem("kino_session") || "{}"); if (s.user && s.expires > Date.now()) return s.user; localStorage.removeItem("kino_session"); } catch { } return null; }
function clearSession() { localStorage.removeItem("kino_session"); }
function genUserId(id: number) { return "#" + String(id).padStart(6, "0"); }

// Ð“Ò¯Ð¹Ð»Ð³ÑÑÐ½Ð¸Ð¹ ÑƒÑ‚Ð³Ð° Ò¯Ò¯ÑÐ³ÑÑ…
function genRef(filmId: number, monthly?: boolean): string {
  const rand = Math.floor(1000 + Math.random() * 9000);
  if (monthly) return `KNM${rand}`;
  return `KN${filmId}${rand}`;
}

const BANKS = [
  { id: "khanbank", name: "Ð¥Ð°Ð°Ð½ Ð±Ð°Ð½Ðº", color: "#00a651", icon: "ðŸ¦", deep: "khanbank://qpay?amount=" },
  { id: "golomt", name: "Ð“Ð¾Ð»Ð¾Ð¼Ñ‚ Ð±Ð°Ð½Ðº", color: "#e4002b", icon: "ðŸ¦", deep: "golomtbank://qpay?amount=" },
  { id: "tdbbank", name: "Ð¥ÐÐ¡ Ð±Ð°Ð½Ðº", color: "#0033a0", icon: "ðŸ¦", deep: "tdb://qpay?amount=" },
  { id: "statebank", name: "Ð¢Ó©Ñ€Ð¸Ð¹Ð½ Ð±Ð°Ð½Ðº", color: "#2c5f9e", icon: "ðŸ¦", deep: "statebank://qpay?amount=" },
  { id: "mbank", name: "Ðœ Ð±Ð°Ð½Ðº", color: "#e8281e", icon: "ðŸ“±", deep: "mbank://qpay?amount=" },
  { id: "most", name: "MOST", color: "#6c3fa0", icon: "ðŸ“±", deep: "most://payment?amount=" },
  { id: "upoint", name: "U-Point", color: "#f97316", icon: "ðŸ“±", deep: "upoint://pay?amount=" },
  { id: "socialpay", name: "SocialPay", color: "#0ea5e9", icon: "ðŸ“±", deep: "socialpay://payment?amount=" },
];

const C = {
  bg: "#0d0d14", card: "#13131c", card2: "#1a1a26", bd: "#1e1e2e",
  txt: "#f0eefa", muted: "#6b6a90",
  red: "#e8281e", gold: "#e8a020", green: "#16a34a", blue: "#2563eb", amber: "#ca8a04",
};

const badgeColor = (b: string) => b === "Ð¥Ð°Ð´Ð¼Ð°Ð»" ? C.amber : C.blue;

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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Ð‘ÐÐÐšÐÐ« ÐœÐ­Ð¡Ð¡Ð­Ð– ÐžÐ Ð›Ð£Ð£Ð›ÐÐ¥ MODAL (ÐÐ´Ð¼Ð¸Ð½)
// Ð¢Ð°Ð½Ñ‹ ÑƒÑ‚Ð°ÑÐ½Ñ‹ Ð¾Ñ€Ð»Ð¾Ð³Ñ‹Ð½ Ð¼ÑÑÑÑÐ¶Ð¸Ð¹Ð³ ÑÐ½Ð´ paste Ñ…Ð¸Ð¹Ð½Ñ
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function SmsVerifyModal({ onClose, onFound }: { onClose: () => void; onFound: (ref: string) => void }) {
  const [smsText, setSmsText] = useState("");
  const [err, setErr] = useState("");

  // ÐœÑÑÑÑÐ¶Ð½ÑÑÑ Ð³Ò¯Ð¹Ð»Ð³ÑÑÐ½Ð¸Ð¹ ÑƒÑ‚Ð³Ð° Ð¾Ð»Ð¾Ñ…
  // Ð–Ð¸ÑˆÑÑ Ð¼ÑÑÑÑÐ¶: "ÐžÑ€Ð»Ð¾Ð³Ð¾: 5,000â‚® Ð“Ò¯Ð¹Ð»Ð³ÑÑÐ½Ð¸Ð¹ ÑƒÑ‚Ð³Ð°: KN3420 ..."
  // Ð¥ÑÐ´ Ñ…ÑÐ´ÑÐ½ Ñ„Ð¾Ñ€Ð¼Ð°Ñ‚Ñ‹Ð³ Ð´ÑÐ¼Ð¶Ð¸Ð½Ñ
  const extractRef = (text: string): string | null => {
    // KNxxxxxx pattern ÑˆÐ°Ð»Ð³Ð°Ñ…
    const match = text.match(/KN\d{5,8}/i);
    if (match) return match[0].toUpperCase();
    return null;
  };

  const verify = () => {
    const ref = extractRef(smsText);
    if (!ref) {
      setErr("ÐœÑÑÑÑÐ¶Ð½ÑÑÑ Ð³Ò¯Ð¹Ð»Ð³ÑÑÐ½Ð¸Ð¹ ÑƒÑ‚Ð³Ð° Ð¾Ð»Ð´ÑÐ¾Ð½Ð³Ò¯Ð¹. 'KN' ÑÑ…ÑÐ»ÑÑÐ½ ÐºÐ¾Ð´Ñ‹Ð³ ÑˆÐ°Ð»Ð³Ð°Ð½Ð° ÑƒÑƒ.");
      return;
    }
    onFound(ref);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.95)", display: "flex", alignItems: "flex-end", zIndex: 300 }}>
      <div style={{ background: C.card, borderRadius: "18px 18px 0 0", padding: "20px 20px 40px", width: "100%", border: `0.5px solid ${C.bd}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.txt }}>ðŸ“© Ð‘Ð°Ð½ÐºÐ½Ñ‹ Ð¼ÑÑÑÑÐ¶ Ð¾Ñ€ÑƒÑƒÐ»Ð°Ñ…</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, fontSize: 24, cursor: "pointer" }}>âœ•</button>
        </div>

        <div style={{ background: C.card2, borderRadius: 10, padding: "10px 14px", marginBottom: 14, border: `0.5px solid ${C.bd}` }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>ðŸ“Œ Ð–Ð¸ÑˆÑÑ Ð¼ÑÑÑÑÐ¶</div>
          <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: "monospace", lineHeight: 1.6 }}>
            ÐžÑ€Ð»Ð¾Ð³Ð¾ 5,000â‚® Ð“Ò¯Ð¹Ð»Ð³ÑÑÐ½Ð¸Ð¹ ÑƒÑ‚Ð³Ð°: <span style={{ color: C.gold }}>KN34208</span> Ð”Ð°Ð½Ñ: XXXX1234 ...
          </div>
        </div>

        <label style={lbl}>Ð‘Ð°Ð½ÐºÐ½Ð°Ð°Ñ Ð¸Ñ€ÑÑÐ½ Ð¼ÑÑÑÑÐ¶Ð¸Ð¹Ð³ Ð´Ð¾Ð¾Ñ€ Ñ…ÑƒÑƒÐ»Ð¶ Ñ‚Ð°Ð²Ð¸Ð½Ð° ÑƒÑƒ</label>
        <textarea
          value={smsText}
          onChange={(e: any) => { setSmsText(e.target.value); setErr(""); }}
          placeholder="ÐœÑÑÑÑÐ¶Ð¸Ð¹Ð³ ÑÐ½Ð´ paste Ñ…Ð¸Ð¹Ð½Ñ Ò¯Ò¯..."
          style={{
            ...inputSt, height: 110, resize: "none",
            lineHeight: 1.6, verticalAlign: "top",
          }}
        />
        {err && <div style={{ color: C.red, fontSize: 12, marginTop: 6 }}>{err}</div>}
        <button onClick={verify} style={{ ...goldBtn, marginTop: 14 }}>
          âœ… Ð¢ÑƒÐ»Ð³Ð°Ñ…
        </button>
        <button onClick={onClose} style={{ width: "100%", background: "none", border: `0.5px solid ${C.bd}`, color: C.muted, padding: 12, borderRadius: 10, fontSize: 14, cursor: "pointer", marginTop: 8 }}>Ð‘ÑƒÑ†Ð°Ñ…</button>
      </div>
    </div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Ð¢Ó¨Ð›Ð‘Ó¨Ð Ð˜Ð™Ð MODAL â€” Ð°Ð²Ñ‚Ð¾Ð¼Ð°Ñ‚ polling + Ð´Ð°Ð½ÑÐ½Ñ‹ Ð¼ÑÐ´ÑÑÐ»ÑÐ»
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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

  // Ð¢Ó©Ð»Ð±Ó©Ñ€ Ò¯Ò¯ÑÐ³ÑÑ… + Ð°Ð²Ñ‚Ð¾Ð¼Ð°Ñ‚ polling ÑÑ…Ð»Ò¯Ò¯Ð»ÑÑ…
  useEffect(() => {
    // Ð‘ÑƒÑ†Ð°Ñ… Ñ‚Ð¾Ð²Ñ‡ Ð´Ð°Ñ€Ð°Ñ…Ð°Ð´ ÑÐ°Ð¹Ñ‚Ð°Ð°Ñ Ð³Ð°Ñ€Ð°Ñ…Ð³Ò¯Ð¹ Ð±Ð°Ð¹Ð»Ð³Ð°Ñ…
    window.history.pushState({ modal: true }, "");
    const handlePop = () => {
      window.history.pushState({ modal: true }, "");
      onClose();
    };
    window.addEventListener("popstate", handlePop);

    if (step !== "waiting") return () => window.removeEventListener("popstate", handlePop);

    // Supabase-Ð´ pending_payments Ò¯Ò¯ÑÐ³ÑÑ…
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

    // ÐÐ²Ñ‚Ð¾Ð¼Ð°Ñ‚ 5 ÑÐµÐºÑƒÐ½Ð´ Ñ‚ÑƒÑ‚Ð°Ð¼Ð´ ÑˆÐ°Ð»Ð³Ð°Ñ…
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

    // 15 Ð¼Ð¸Ð½ÑƒÑ‚Ñ‹Ð½ Ð´Ð°Ñ€Ð°Ð° timeout
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

  // SMS Ð¼ÑÑÑÑÐ¶Ð½ÑÑÑ ref Ð¾Ð»ÑÐ½Ñ‹ Ð´Ð°Ñ€Ð°Ð° Ð³Ð°Ñ€Ð°Ð°Ñ€ ÑˆÐ°Ð»Ð³Ð°Ñ…
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
      alert(`"${foundRef}" ÐºÐ¾Ð´Ñ‚Ð¾Ð¹ Ñ‚Ó©Ð»Ð±Ó©Ñ€ Ð¾Ð»Ð´ÑÐ¾Ð½Ð³Ò¯Ð¹. Ð“Ò¯Ð¹Ð»Ð³ÑÑÐ½Ð¸Ð¹ ÑƒÑ‚Ð³Ñ‹Ð³ Ð·Ó©Ð² Ð±Ð¸Ñ‡ÑÑÐ½ ÑÑÑÑ…Ð¸Ð¹Ð³ ÑˆÐ°Ð»Ð³Ð°Ð½Ð° ÑƒÑƒ.`);
    }
  };

  if (autoStatus === "paid") {
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.97)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 72, marginBottom: 12 }}>âœ…</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.green }}>Ð¢Ó©Ð»Ð±Ó©Ñ€ Ð±Ð°Ñ‚Ð°Ð»Ð³Ð°Ð°Ð¶Ð»Ð°Ð°!</div>
          <div style={{ fontSize: 14, color: C.muted, marginTop: 8 }}>ÐšÐ¸Ð½Ð¾ ÑÑ…ÑÐ»Ð¶ Ð±Ð°Ð¹Ð½Ð°...</div>
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
            <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, fontSize: 24, cursor: "pointer" }}>âœ•</button>
          </div>

          {/* Ò®Ð½Ñ */}
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 36, fontWeight: 900, color: film.monthly ? "#a855f7" : C.gold }}>{film.price?.toLocaleString()}â‚®</div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{film.monthly ? "1 ÑÐ°Ñ€Ñ‹Ð½ Ñ…ÑÐ·Ð³Ð°Ð°Ñ€Ð³Ò¯Ð¹ ÑÑ€Ñ…" : "Ð´Ð°Ñ€Ð°Ð°Ñ… Ð´Ð°Ð½Ñ Ñ€ÑƒÑƒ ÑˆÐ¸Ð»Ð¶Ò¯Ò¯Ð»Ð½Ñ Ò¯Ò¯"}</div>
          </div>

          {/* Ð”Ð°Ð½ÑÐ½Ñ‹ Ð¼ÑÐ´ÑÑÐ»ÑÐ» */}
          <div style={{ background: "#050d1a", border: `1.5px solid ${C.gold}`, borderRadius: 14, padding: "16px 18px", marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 12, letterSpacing: "0.08em", textTransform: "uppercase" }}>ðŸ¦ Ð”Ð°Ð½ÑÐ½Ñ‹ Ð¼ÑÐ´ÑÑÐ»ÑÐ»</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: C.muted }}>Ð‘Ð°Ð½Ðº</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.txt }}>{BANK_ACCOUNT.bank}</span>
            </div>
            {/* IBN Ð´ÑƒÐ³Ð°Ð°Ñ€ */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: C.muted }}>IBN</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.txt, fontFamily: "monospace" }}>{BANK_ACCOUNT.ibn}</span>
            </div>
            {/* Ð”Ð°Ð½ÑÐ½Ñ‹ Ð´ÑƒÐ³Ð°Ð°Ñ€ â€” Ñ‚Ð¾Ð¼, Ð´Ð°Ñ€Ð°Ñ…Ð°Ð´ copy */}
            <div
              onClick={() => copyText(BANK_ACCOUNT.number, "account")}
              style={{ background: copied === "account" ? "#052e16" : "#0a1628", border: `1.5px solid ${copied === "account" ? C.green : C.gold}`, borderRadius: 12, padding: "14px 16px", textAlign: "center", cursor: "pointer", marginBottom: 8, transition: "all 0.2s" }}
            >
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Ð”Ð°Ð½ÑÐ½Ñ‹ Ð´ÑƒÐ³Ð°Ð°Ñ€ â€” Ð´Ð°Ñ€Ð¶ Ñ…ÑƒÑƒÐ»Ð½Ð° ÑƒÑƒ</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: copied === "account" ? C.green : "#fbbf24", fontFamily: "monospace", letterSpacing: "0.1em" }}>
                {BANK_ACCOUNT.number}
              </div>
              <div style={{ fontSize: 12, color: copied === "account" ? C.green : C.muted, marginTop: 4 }}>
                {copied === "account" ? "âœ… Ð¥ÑƒÑƒÐ»Ð°Ð³Ð´Ð»Ð°Ð°!" : "ðŸ‘† Ð”Ð°Ñ€Ð¶ Ñ…ÑƒÑƒÐ»Ð°Ñ…"}
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: C.muted }}>Ð­Ð·ÑÐ¼ÑˆÐ¸Ð³Ñ‡</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.txt }}>{BANK_ACCOUNT.name}</span>
            </div>
          </div>

          {/* Ð“Ò¯Ð¹Ð»Ð³ÑÑÐ½Ð¸Ð¹ ÑƒÑ‚Ð³Ð° â€” Ð¼Ð°Ñˆ Ñ‚Ð¾Ð¼ */}
          <div onClick={() => copyText(refCode, "ref")} style={{ background: copied === "ref" ? "#052e16" : "#1a0a00", border: `3px solid ${copied === "ref" ? C.green : "#f97316"}`, borderRadius: 16, padding: "20px 16px", marginBottom: 14, textAlign: "center", cursor: "pointer", transition: "all 0.2s", boxShadow: copied === "ref" ? "none" : "0 0 20px #f9731640" }}>
            <div style={{ fontSize: 13, color: copied === "ref" ? C.green : "#f97316", marginBottom: 10, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 800 }}>
              {copied === "ref" ? "âœ… Ð¥ÑƒÑƒÐ»Ð°Ð³Ð´Ð»Ð°Ð°!" : "âš ï¸ Ð—Ó¨Ð’Ð¥Ó¨Ð Ð­ÐÐ­ ÐšÐžÐ”Ð«Ð“ Ð“Ò®Ð™Ð›Ð“Ð­Ð­ÐÐ˜Ð™ Ð£Ð¢Ð“Ð Ð”Ð­Ð­Ð  Ð‘Ð˜Ð§ÐÐ­!"}
            </div>
            <div style={{ fontSize: 42, fontWeight: 900, color: copied === "ref" ? C.green : "#fb923c", letterSpacing: "0.25em", fontFamily: "monospace", marginBottom: 12 }}>
              {refCode}
            </div>
            <div style={{ background: copied === "ref" ? "#166534" : "#f97316", borderRadius: 10, padding: "10px 20px", display: "inline-block" }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>
                {copied === "ref" ? "âœ“ Ð¥ÑƒÑƒÐ»Ð°Ð³Ð´Ð»Ð°Ð°" : "ðŸ‘† Ð”ÐÐ Ð– Ð¥Ð£Ð£Ð›ÐÐ¥"}
              </span>
            </div>
          </div>

          {/* ÐÐ²Ñ‚Ð¾Ð¼Ð°Ñ‚ Ñ…Ò¯Ð»ÑÑÐ¶ Ð±Ð°Ð¹Ð½Ð° */}
          <div style={{ background: C.card2, borderRadius: 10, padding: "10px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 20 }}>{autoStatus === "checking" ? "ðŸ”„" : "â³"}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.txt }}>
                {autoStatus === "checking" ? "Ð¨Ð°Ð»Ð³Ð°Ð¶ Ð±Ð°Ð¹Ð½Ð°..." : "Ð¢Ó©Ð»Ð±Ó©Ñ€Ð¸Ð¹Ð³ Ñ…Ò¯Ð»ÑÑÐ¶ Ð±Ð°Ð¹Ð½Ð°"}
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>ÐœÓ©Ð½Ð³Ó© ÑˆÐ¸Ð»Ð¶Ò¯Ò¯Ð»ÑÐ½Ð¸Ð¹ Ð´Ð°Ñ€Ð°Ð° Ð°Ð²Ñ‚Ð¾Ð¼Ð°Ñ‚Ð°Ð°Ñ€ Ð½ÑÑÐ³Ð´ÑÐ½Ñ</div>
            </div>
          </div>

          <button onClick={onClose} style={{ width: "100%", background: "none", border: `0.5px solid ${C.bd}`, color: C.muted, padding: 12, borderRadius: 10, fontSize: 14, cursor: "pointer" }}>Ð‘ÑƒÑ†Ð°Ñ…</button>
        </div>
      </div>
      {showSms && <SmsVerifyModal onClose={() => setShowSms(false)} onFound={handleSmsFound} />}
    </>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ADMIN â€” Ð¼ÑÑÑÑÐ¶ ÑˆÐ°Ð»Ð³Ð°Ñ… Ñ‚Ð°Ð± Ð½ÑÐ¼ÑÐ³Ð´Ð»ÑÑ
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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
        <div style={{ fontSize: 14, fontWeight: 700, color: C.txt, marginBottom: 12 }}>ðŸ“© Ð‘Ð°Ð½ÐºÐ½Ñ‹ Ð¼ÑÑÑÑÐ¶ ÑˆÐ°Ð»Ð³Ð°Ñ…</div>
        <label style={lbl}>ÐžÑ€Ð»Ð¾Ð³Ñ‹Ð½ Ð¼ÑÑÑÑÐ¶Ð¸Ð¹Ð³ paste Ñ…Ð¸Ð¹Ð½Ñ Ò¯Ò¯</label>
        <textarea
          value={smsText}
          onChange={(e: any) => { setSmsText(e.target.value); setStatus("idle"); setResult(null); }}
          placeholder={"ÐžÑ€Ð»Ð¾Ð³Ð¾ 5,000â‚® Ð“Ò¯Ð¹Ð»Ð³ÑÑÐ½Ð¸Ð¹ ÑƒÑ‚Ð³Ð°: KN34208 ..."}
          style={{ ...inputSt, height: 100, resize: "none", lineHeight: 1.6 }}
        />
        <button onClick={check} style={{ ...goldBtn, marginTop: 10 }}>
          ðŸ” Ð¨Ð°Ð»Ð³Ð°Ñ…
        </button>
      </div>

      {status === "checking" && (
        <div style={{ textAlign: "center", color: C.muted, padding: 16 }}>Ð¨Ð°Ð»Ð³Ð°Ð¶ Ð±Ð°Ð¹Ð½Ð°...</div>
      )}

      {status === "found" && result && (
        <div style={{ background: result.status === "confirmed" ? "#052e16" : "#1c1400", border: `0.5px solid ${result.status === "confirmed" ? "#166534" : C.gold}`, borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: result.status === "confirmed" ? "#4ade80" : C.gold, marginBottom: 10 }}>
            {result.status === "confirmed" ? "âœ… Ð‘Ð°Ñ‚Ð°Ð»Ð³Ð°Ð°Ð¶ÑÐ°Ð½" : "â³ Ð¥Ò¯Ð»ÑÑÐ³Ð´ÑÐ¶ Ð±Ð°Ð¹Ð½Ð°"}
          </div>
          <div style={{ fontSize: 12, color: C.muted, lineHeight: 2 }}>
            ÐšÐ¾Ð´: <span style={{ color: C.txt, fontFamily: "monospace" }}>{result.ref_code}</span><br />
            ÐšÐ¸Ð½Ð¾ ID: <span style={{ color: C.txt }}>{result.film_id}</span><br />
            Ð”Ò¯Ð½: <span style={{ color: C.gold }}>{result.amount?.toLocaleString()}â‚®</span>
          </div>
          {result.status === "pending" && (
            <button onClick={confirm} style={{ ...goldBtn, marginTop: 12 }}>
              âœ… Ð“Ð°Ñ€Ð°Ð°Ñ€ Ð±Ð°Ñ‚Ð°Ð»Ð³Ð°Ð°Ð¶ÑƒÑƒÐ»Ð°Ñ…
            </button>
          )}
        </div>
      )}

      {status === "notfound" && (
        <div style={{ background: "#1a0808", border: `0.5px solid #3a1a1a`, borderRadius: 12, padding: 14, color: "#f05555", fontSize: 13 }}>
          âŒ ÐœÑÑÑÑÐ¶Ð½ÑÑÑ Ñ‚Ð¾Ñ…Ð¸Ñ€Ð¾Ñ… Ð³Ò¯Ð¹Ð»Ð³ÑÑ Ð¾Ð»Ð´ÑÐ¾Ð½Ð³Ò¯Ð¹
        </div>
      )}
    </div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Ð”Ð°Ñ€Ð°Ð°Ñ… ÐºÐ¾Ð¼Ð¿Ð¾Ð½ÐµÐ½Ñ‚ÑƒÑƒÐ´ Ó©Ð¼Ð½Ó©Ñ…Ñ‚ÑÐ¹ Ð°Ð´Ð¸Ð» Ò¯Ð»Ð´ÑÑÐ½
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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

function PreviewModal({ film, onClose, onWatch, expiry }: any) {
  const previewFromUrl = film.url && film.url.includes("|||") ? film.url.split("|||")[1] : null;
  const isPlayerUrl = previewFromUrl && (previewFromUrl.includes("mediadelivery.net") || previewFromUrl.includes("bunny.net"));
  const iframeSrc = isPlayerUrl && previewFromUrl
    ? (previewFromUrl.includes("player.mediadelivery.net/play")
        ? previewFromUrl.replace("player.mediadelivery.net/play", "iframe.mediadelivery.net/embed") + (previewFromUrl.includes("?") ? "&" : "?") + "autoplay=true&muted=true&loop=true"
        : previewFromUrl + (previewFromUrl.includes("?") ? "&" : "?") + "autoplay=true&muted=true&loop=true")
    : null;
  const videoRef = useRef<any>(null);

  useEffect(() => {
    if (!isPlayerUrl && videoRef.current && previewFromUrl) {
      videoRef.current.muted = true;
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 200,
        background: "#000",
      }}
    >
      <div style={{ position: "relative", width: "100%", height: "56vw", maxHeight: "70vh" }}>
        {isPlayerUrl && iframeSrc ? (
          <iframe
            src={iframeSrc}
            allow="autoplay; encrypted-media"
            allowFullScreen
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
          />
        ) : previewFromUrl ? (
          <video
            ref={videoRef}
            src={previewFromUrl}
            muted playsInline loop
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : null}
      </div>
    </div>
  );
}

function FilmCard({ film, onClick, expiry }: any) {
  const [showPreview, setShowPreview] = useState(false);
  const timerRef = useRef<any>(null);
  const touchTimer = useRef<any>(null);
  const previewFromUrl = film.url && film.url.includes("|||") ? film.url.split("|||")[1] : null;

  const startPreview = () => {
    if (!previewFromUrl) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setShowPreview(true), 150);
  };

  const stopPreview = () => {
    clearTimeout(timerRef.current);
    setShowPreview(false);
  };

  const handleTouchStart = () => {
    clearTimeout(touchTimer.current);
    touchTimer.current = setTimeout(() => setShowPreview(true), 150);
  };

  const handleTouchEnd = () => {
    clearTimeout(touchTimer.current);
    setShowPreview(false);
  };

  return (
    <>
      {showPreview && previewFromUrl && (
        <PreviewModal
          film={film}
          expiry={expiry}
          onClose={stopPreview}
          onWatch={() => { stopPreview(); onClick(); }}
        />
      )}
      <div
        onClick={onClick}
        onMouseEnter={startPreview}
        onMouseLeave={stopPreview}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        style={{ background: C.card, borderRadius: 12, overflow: "hidden", cursor: "pointer", border: `0.5px solid ${expiry ? C.green : C.bd}`, WebkitTapHighlightColor: "transparent" }}
      >
        <div style={{ position: "relative", aspectRatio: "16/9", overflow: "hidden" }}>
          {film.img
            ? <img src={film.img} alt={film.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <div style={{ width: "100%", height: "100%", background: `linear-gradient(160deg,${film.bg || "#1a0820"} 0%,#000 100%)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 44 }}>ðŸŽ¬</span>
            </div>
          }
          <div style={{ position: "absolute", top: 8, left: 8, background: badgeColor(film.badge), borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 700, color: "#fff" }}>
            {film.badge}
          </div>
          {expiry && (
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(22,163,74,0.85)", padding: "4px 6px", textAlign: "center" }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#fff" }}>{expiry}</span>
            </div>
          )}
          {previewFromUrl && (
            <div style={{ position: "absolute", bottom: expiry ? 28 : 8, right: 8, background: "rgba(0,0,0,0.6)", borderRadius: 10, padding: "2px 7px", fontSize: 10, color: "#fff" }}>
              â–¶ preview
            </div>
          )}
        </div>
        <div style={{ padding: "7px 8px 10px" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.txt, lineHeight: 1.3, marginBottom: 5 }}>{film.title}</div>
          {!film.free && <div style={{ fontSize: 10, color: C.muted, textDecoration: "line-through", marginBottom: 1 }}>{film.op?.toLocaleString()}â‚®</div>}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: film.free ? C.green : expiry ? C.green : C.gold }}>
              {film.free ? "Ò®Ð½ÑÐ³Ò¯Ð¹" : expiry ? "ÐÑÑÐ»Ñ‚Ñ‚ÑÐ¹" : `${film.price?.toLocaleString()}â‚®`}
            </span>
            {film.free || expiry
              ? <button style={{ background: C.green, border: "none", color: "#fff", borderRadius: 16, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>â–¶ Ò®Ð·ÑÑ…</button>
              : null
            }
          </div>
        </div>
      </div>
    </>
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
    const newMsg = { phone: user?.phone || "â€”", message: msg.trim(), user_id: user?.id || null, read: false };
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
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, fontSize: 22, cursor: "pointer" }}>â†</button>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.txt }}>ðŸ’¬ ÐÐ´Ð¼Ð¸Ð½Ñ‚Ð°Ð¹ Ñ…Ð¾Ð»Ð±Ð¾Ð³Ð´Ð¾Ñ…</div>
            <div style={{ fontSize: 11, color: C.green }}>â— ÐžÐ½Ð»Ð°Ð¹Ð½</div>
          </div>
        </div>
      </div>

      {/* Ð§Ð°Ñ‚Ñ‹Ð½ Ð¼ÐµÑÑÐµÐ¶Ò¯Ò¯Ð´ */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
        {loading ? (
          <div style={{ textAlign: "center", color: C.muted, marginTop: 40 }}>ÐÑ‡Ð°Ð°Ð»Ð»Ð°Ð¶ Ð±Ð°Ð¹Ð½Ð°...</div>
        ) : msgs.length === 0 ? (
          <div style={{ textAlign: "center", color: C.muted, marginTop: 40, fontSize: 13 }}>ÐÑÑƒÑƒÐ»Ñ‚, ÑÐ°Ð½Ð°Ð» Ñ…Ò¯ÑÑÐ»Ñ‚ÑÑ Ð±Ð¸Ñ‡Ð½Ñ Ò¯Ò¯</div>
        ) : (
          msgs.map(m => (
            <div key={m.id}>
              {/* Ð¥ÑÑ€ÑÐ³Ð»ÑÐ³Ñ‡Ð¸Ð¹Ð½ Ð¼ÐµÑÑÐµÐ¶ â€” Ð±Ð°Ñ€ÑƒÑƒÐ½ Ñ‚Ð°Ð» */}
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
                <div style={{ background: C.blue, borderRadius: "16px 16px 4px 16px", padding: "10px 14px", maxWidth: "75%", fontSize: 14, color: "#fff" }}>
                  {m.message}
                </div>
              </div>
              {/* ÐÐ´Ð¼Ð¸Ð½Ñ‹ Ñ…Ð°Ñ€Ð¸Ñƒ â€” Ð·Ò¯Ò¯Ð½ Ñ‚Ð°Ð» */}
              {m.reply && (
                <div style={{ display: "flex", justifyContent: "flex-start", marginTop: 4 }}>
                  <div style={{ background: C.card2, borderRadius: "16px 16px 16px 4px", padding: "10px 14px", maxWidth: "75%", fontSize: 14, color: C.txt, border: `0.5px solid ${C.bd}` }}>
                    <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>ÐÐ´Ð¼Ð¸Ð½</div>
                    {m.reply}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* ÐœÐµÑÑÐµÐ¶ Ð±Ð¸Ñ‡Ð¸Ñ… Ñ…ÑÑÑÐ³ */}
      <div style={{ background: C.card, borderTop: `0.5px solid ${C.bd}`, padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-end", flexShrink: 0 }}>
        <textarea
          value={msg}
          onChange={(e: any) => setMsg(e.target.value)}
          onKeyDown={(e: any) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="ÐœÐµÑÑÐµÐ¶ Ð±Ð¸Ñ‡Ð½Ñ Ò¯Ò¯..."
          style={{ ...inputSt, flex: 1, height: 44, resize: "none", lineHeight: 1.5, borderRadius: 22, padding: "11px 16px" }}
        />
        <button onClick={send} disabled={sending || !msg.trim()}
          style={{ background: msg.trim() ? C.blue : C.card2, border: "none", borderRadius: "50%", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, fontSize: 18 }}>
          âž¤
        </button>
      </div>
    </div>
  );
}

function LoginModal({ onLogin }: { onLogin: (u: any) => void }) {
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [isNew, setIsNew] = useState(false);
  const [step, setStep] = useState<"phone"|"pin"|"reset">("phone");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const phoneRef = useRef<any>(null);
  const pinRef = useRef<any>(null);
  const pin2Ref = useRef<any>(null);

  // Ð£Ñ‚Ð°ÑÐ½Ñ‹ Ð´ÑƒÐ³Ð°Ð°Ñ€ 8 Ð¾Ñ€Ð¾Ð½ Ð±Ò¯Ñ€ÑÐ½ Ð±Ð¾Ð»Ð¼Ð¾Ð³Ñ† Ð°Ð²Ñ‚Ð¾Ð¼Ð°Ñ‚Ð°Ð°Ñ€ PIN Ñ€ÑƒÑƒ ÑˆÐ¸Ð»Ð¶Ð¸Ñ…
  const handlePhoneChange = async (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 8);
    setPhone(digits);
    setErr("");
    if (digits.length === 8) {
      setLoading(true);
      const ex = await dbFetch(`users?phone=eq.${digits}&select=id`);
      setIsNew(!(Array.isArray(ex) && ex.length > 0));
      setLoading(false);
      setPin(""); setPin2("");
      setStep("pin");
      setTimeout(() => pinRef.current?.focus(), 100);
    }
  };

  const handlePinChange = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 4);
    setPin(digits);
    setErr("");
    if (digits.length === 4 && !isNew) {
      submitPin(digits);
    }
  };

  const handlePin2Change = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 4);
    setPin2(digits);
    setErr("");
  };

  const submitPin = async (pinVal: string) => {
    setLoading(true); setErr("");
    const data = await dbFetch(`users?phone=eq.${phone}&select=*`);
    if (!Array.isArray(data) || !data.length) { setErr("Ð‘Ò¯Ñ€Ñ‚Ð³ÑÐ»Ð³Ò¯Ð¹ Ð´ÑƒÐ³Ð°Ð°Ñ€"); setLoading(false); return; }
    const u = data[0];
    if (u.locked_until && new Date(u.locked_until) > new Date()) { setErr("15 Ð¼Ð¸Ð½ÑƒÑ‚ Ñ…Ò¯Ð»ÑÑÐ½Ñ Ò¯Ò¯"); setLoading(false); return; }
    if (u.pin !== pinVal) {
      const att = (u.failed_attempts || 0) + 1;
      const lk = att >= 3 ? { locked_until: new Date(Date.now() + 15 * 60 * 1000).toISOString() } : {};
      await dbFetch(`users?id=eq.${u.id}`, { method: "PATCH", body: JSON.stringify({ failed_attempts: att, ...lk }) });
      setErr(att >= 3 ? "3 ÑƒÐ´Ð°Ð° Ð±ÑƒÑ€ÑƒÑƒ. 15 Ð¼Ð¸Ð½ÑƒÑ‚ Ñ…Ò¯Ð»ÑÑÐ½Ñ Ò¯Ò¯" : `PIN Ð±ÑƒÑ€ÑƒÑƒ (${3 - att} Ð¾Ñ€Ð¾Ð»Ð´Ð»Ð¾Ð³Ð¾)`);
      setPin("");
      setShowReset(true);
      setTimeout(() => pinRef.current?.focus(), 100);
      setLoading(false); return;
    }
    await dbFetch(`users?id=eq.${u.id}`, { method: "PATCH", body: JSON.stringify({ failed_attempts: 0, locked_until: null }) });
    saveSession(u); onLogin(u);
    setLoading(false);
  };

  const resetPin = async () => {
    if (pin.length !== 4) { setErr("Ð¨Ð¸Ð½Ñ 4 Ð¾Ñ€Ð¾Ð½Ñ‚Ð¾Ð¹ PIN Ð¾Ñ€ÑƒÑƒÐ»Ð½Ð° ÑƒÑƒ"); return; }
    if (pin !== pin2) { setErr("PIN Ñ‚Ð°Ð°Ñ€Ð°Ñ…Ð³Ò¯Ð¹ Ð±Ð°Ð¹Ð½Ð°"); return; }
    setLoading(true); setErr("");
    const data = await dbFetch(`users?phone=eq.${phone}&select=id`);
    if (!Array.isArray(data) || !data.length) { setErr("Ð”ÑƒÐ³Ð°Ð°Ñ€ Ð¾Ð»Ð´ÑÐ¾Ð½Ð³Ò¯Ð¹"); setLoading(false); return; }
    await dbFetch(`users?id=eq.${data[0].id}`, { method: "PATCH", body: JSON.stringify({ pin, failed_attempts: 0, locked_until: null }) });
    setLoading(false);
    setStep("pin"); setShowReset(false); setPin(""); setPin2(""); setErr("");
    setTimeout(() => pinRef.current?.focus(), 100);
  };

  const submitRegister = async () => {
    if (pin.length !== 4) { setErr("4 Ð¾Ñ€Ð¾Ð½Ñ‚Ð¾Ð¹ PIN Ð¾Ñ€ÑƒÑƒÐ»Ð½Ð° ÑƒÑƒ"); return; }
    setLoading(true); setErr("");
    const data = await dbFetch("users", { method: "POST", body: JSON.stringify({ phone, pin, user_id: "tmp", failed_attempts: 0 }) });
    if (data?.[0]?.id) {
      const uid = genUserId(data[0].id);
      await dbFetch(`users?id=eq.${data[0].id}`, { method: "PATCH", body: JSON.stringify({ user_id: uid }) });
      saveSession({ ...data[0], user_id: uid });
      onLogin({ ...data[0], user_id: uid });
    } else { setErr("Ð‘Ò¯Ñ€Ñ‚Ð³ÑÐ» Ð°Ð¼Ð¶Ð¸Ð»Ñ‚Ð³Ò¯Ð¹"); }
    setLoading(false);
  };

  // PIN dots Ñ…Ð°Ñ€ÑƒÑƒÐ»Ð°Ñ…
  const PinDots = ({ val }: { val: string }) => (
    <div style={{ display: "flex", gap: 14, justifyContent: "center", margin: "16px 0" }}>
      {[0,1,2,3].map(i => (
        <div key={i} style={{
          width: 62, height: 62, borderRadius: 14,
          background: val[i] ? "#1e2d4a" : "#0d0d1a",
          border: `2.5px solid ${err ? C.red : val[i] ? "#60a5fa" : "#2a2a40"}`,
          boxShadow: val[i] ? "0 0 12px rgba(96,165,250,0.3)" : "none",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 30, color: "#60a5fa", transition: "all 0.15s",
        }}>
          {val[i] ? "â—" : ""}
        </div>
      ))}
    </div>
  );

  if (step === "phone") return (
    <div>
      <input
        ref={phoneRef}
        autoFocus
        type="tel"
        inputMode="numeric"
        maxLength={8}
        value={phone}
        onChange={(e: any) => handlePhoneChange(e.target.value)}
        placeholder="88123456"
        disabled={loading}
        style={{
          ...inputSt, fontSize: 26, fontWeight: 800, textAlign: "center",
          letterSpacing: "0.2em", padding: 16, borderRadius: 12,
          border: `2px solid #3b82f6`, background: "#08080f",
          opacity: loading ? 0.6 : 1,
        }}
      />
      {loading && <div style={{ textAlign: "center", color: C.muted, fontSize: 13, marginTop: 8 }}>Ð¨Ð°Ð»Ð³Ð°Ð¶ Ð±Ð°Ð¹Ð½Ð°...</div>}
      {err && <div style={{ color: C.red, fontSize: 12, marginTop: 6, textAlign: "center" }}>{err}</div>}
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.gold, letterSpacing: "0.1em" }}>{phone}</div>
        <button onClick={() => { setStep("phone"); setPin(""); setPin2(""); setErr(""); }}
          style={{ background: "none", border: "none", color: "#3b82f6", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>â† Ó¨Ó©Ñ€Ñ‡Ð»Ó©Ñ…</button>
      </div>
      <label style={{ ...lbl, fontSize: 12, marginBottom: 4, textAlign: "center", display: "block" }}>
        {isNew ? "Ð¨Ð¸Ð½Ñ PIN Ñ‚Ð¾Ñ…Ð¸Ñ€ÑƒÑƒÐ»Ð½Ð° ÑƒÑƒ" : "PIN ÐºÐ¾Ð´"}
      </label>
      {/* Ð”Ð°Ð»Ð´ input + Ñ…Ð°Ñ€Ð°Ð³Ð´Ð°Ñ… dots */}
      <div style={{ position: "relative" }}>
        <PinDots val={pin} />
        <input ref={pinRef} type="tel" inputMode="numeric" maxLength={4} value={pin}
          onChange={(e: any) => handlePinChange(e.target.value)}
          style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }}
        />
      </div>
      {isNew && (
        <>
          {err && <div style={{ color: C.red, fontSize: 12, marginBottom: 8, textAlign: "center" }}>{err}</div>}
          <button onClick={submitRegister} disabled={loading || pin.length !== 4}
            style={{ ...goldBtn, borderRadius: 12, fontSize: 15, padding: 14, opacity: loading || pin.length !== 4 ? 0.5 : 1 }}>
            {loading ? "Ð¢Ò¯Ñ€ Ñ…Ò¯Ð»ÑÑÐ½Ñ Ò¯Ò¯..." : "âœ… Ð‘Ò¯Ñ€Ñ‚Ð³Ò¯Ò¯Ð»ÑÑ…"}
          </button>
        </>
      )}
      {!isNew && err && (
        <div style={{ marginTop: 8 }}>
          <div style={{ color: C.red, fontSize: 12, textAlign: "center", marginBottom: 10 }}>{err}</div>
          {showReset && (
            <button onClick={() => { setStep("reset"); setPin(""); setPin2(""); setErr(""); setShowReset(false); }}
              style={{ width:"100%", background:"none", border:`1px solid ${C.bd}`, color:"#3b82f6", borderRadius:10, padding:"10px", fontSize:13, cursor:"pointer", fontWeight:600 }}>
              ðŸ”‘ PIN ÐºÐ¾Ð´ ÑÐ¾Ð»Ð¸Ñ…
            </button>
          )}
        </div>
      )}
      {loading && !isNew && <div style={{ textAlign: "center", color: C.muted, fontSize: 13, marginTop: 8 }}>ÐÑÐ²Ñ‚ÑÑ€Ñ‡ Ð±Ð°Ð¹Ð½Ð°...</div>}

      {step === "reset" && (
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.txt, marginBottom: 12, textAlign:"center" }}>ðŸ”‘ Ð¨Ð¸Ð½Ñ PIN Ñ‚Ð¾Ñ…Ð¸Ñ€ÑƒÑƒÐ»Ð°Ñ…</div>
          <label style={{ ...lbl, fontSize: 12, marginBottom: 4, textAlign: "center", display: "block" }}>Ð¨Ð¸Ð½Ñ PIN</label>
          <div style={{ position: "relative" }}>
            <PinDots val={pin} />
            <input ref={pinRef} type="tel" inputMode="numeric" maxLength={4} value={pin}
              onChange={(e: any) => { setPin(e.target.value.replace(/\D/g,"").slice(0,4)); setErr(""); }}
              style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }}
            />
          </div>
          <label style={{ ...lbl, fontSize: 12, marginBottom: 4, textAlign: "center", display: "block" }}>PIN Ð´Ð°Ð²Ñ‚Ð°Ñ…</label>
          <div style={{ position: "relative" }}>
            <PinDots val={pin2} />
            <input ref={pin2Ref} type="tel" inputMode="numeric" maxLength={4} value={pin2}
              onChange={(e: any) => { setPin2(e.target.value.replace(/\D/g,"").slice(0,4)); setErr(""); }}
              style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }}
            />
          </div>
          {err && <div style={{ color: C.red, fontSize: 12, marginBottom: 8, textAlign: "center" }}>{err}</div>}
          <button onClick={resetPin} disabled={loading || pin.length !== 4 || pin2.length !== 4}
            style={{ ...goldBtn, borderRadius: 12, fontSize: 15, padding: 14, opacity: loading || pin.length !== 4 || pin2.length !== 4 ? 0.5 : 1, marginTop: 4 }}>
            {loading ? "Ð¥Ð°Ð´Ð³Ð°Ð»Ð¶ Ð±Ð°Ð¹Ð½Ð°..." : "âœ… PIN ÑÐ¾Ð»Ð¸Ñ…"}
          </button>
          <button onClick={() => { setStep("pin"); setPin(""); setPin2(""); setErr(""); setTimeout(()=>pinRef.current?.focus(),100); }}
            style={{ width:"100%", background:"none", border:"none", color: C.muted, fontSize:13, cursor:"pointer", marginTop:8 }}>
            Ð‘ÑƒÑ†Ð°Ñ…
          </button>
        </div>
      )}
    </div>
  );
}


function HomePage({ films, onFilm, onSearch, onAdmin, loading, user, onLogin, onLogout, onMonthly, onContact, accessMap, onInstall, onOpenLogin }: any) {
  const tapRef = useRef<{ count: number; timer: any }>({ count: 0, timer: null });
  const handleLogoTap = () => {
    tapRef.current.count += 1;
    if (tapRef.current.timer) clearTimeout(tapRef.current.timer);
    if (tapRef.current.count >= 4) { tapRef.current.count = 0; onAdmin(); }
    else { tapRef.current.timer = setTimeout(() => { tapRef.current.count = 0; }, 3000); }
  };

  const getExpiry = (filmId: number): string | null => {
    if (!user) return null;
    const now = Date.now();
    if (accessMap?.["monthly"] && accessMap["monthly"] > now) {
      const h = Math.ceil((accessMap["monthly"] - now) / 3600000);
      return h > 24 ? `ðŸ‘‘ ${Math.ceil(h/24)} Ñ…Ð¾Ð½Ð¾Ð³ Ò¯Ð»Ð´ÑÑÐ½` : `ðŸ‘‘ ${h}Ñ† Ò¯Ð»Ð´ÑÑÐ½`;
    }
    const key = `film_${filmId}`;
    if (accessMap?.[key] && accessMap[key] > now) {
      const h = Math.ceil((accessMap[key] - now) / 3600000);
      return h > 1 ? `ðŸ• ${h}Ñ† Ò¯Ð»Ð´ÑÑÐ½` : "ðŸ• <1Ñ† Ò¯Ð»Ð´ÑÑÐ½";
    }
    return null;
  };

  const openLogin = () => onOpenLogin();
  const handleLoginDone = (u: any) => { onLogin(u); };

  return (
    <div style={{ background: C.bg, minHeight: "100vh", paddingBottom: 20 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* â”€â”€ STICKY NAVBAR ONLY â”€â”€ */}
        <div style={{ position: "sticky", top: 0, zIndex: 10, background: C.bg, borderBottom: `0.5px solid ${C.bd}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px" }}>
            <a href="https://m.me/61590383810997" target="_blank" rel="noopener noreferrer" style={{ background: "none", border: `0.5px solid #1877f2`, borderRadius: 16, padding: "5px 10px", fontSize: 11, fontWeight: 700, color: "#1877f2", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
              ðŸ’¬ Messenger
            </a>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button onClick={onSearch} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 20 }}>ðŸ”</button>
              {user
                ? <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12, color: C.gold, fontWeight: 700 }}>{user.phone}</span>
                    <button onClick={onLogout} style={{ background: C.card2, border: `0.5px solid ${C.bd}`, color: C.muted, cursor: "pointer", fontSize: 11, borderRadius: 8, padding: "5px 8px" }}>Ð“Ð°Ñ€Ð°Ñ…</button>
                  </div>
                : null
              }
              <button onClick={onContact} style={{ background: C.card2, border: `0.5px solid ${C.bd}`, color: C.muted, cursor: "pointer", fontSize: 12, borderRadius: 8, padding: "6px 10px" }}>ðŸ’¬</button>
              <button onClick={handleLogoTap} style={{ background: C.card2, border: `0.5px solid ${C.bd}`, color: C.muted, cursor: "pointer", fontSize: 12, borderRadius: 8, padding: "6px 10px" }}>âš™ï¸</button>
              <button onClick={onInstall} style={{ background: C.card2, border: `0.5px solid ${C.bd}`, color: "#60a5fa", cursor: "pointer", fontSize: 12, borderRadius: 8, padding: "6px 10px", fontWeight: 700 }}>ðŸ“² ÐÐ¿Ð¿</button>
            </div>
          </div>
        </div>

        {/* â”€â”€ 1 Ð¡ÐÐ Ð«Ð Ð‘ÐÐ“Ð¦ â€” ÐºÐ¸Ð½Ð¾Ð½ÑƒÑƒÐ´Ñ‚Ð°Ð¹ Ñ…Ð°Ð¼Ñ‚ scroll ÑÐ²Ð½Ð° â”€â”€ */}
        {user && (
          <div style={{ padding: "8px 12px" }}>
            <div onClick={onMonthly} style={{ background: "linear-gradient(90deg,#7c3aed,#a855f7)", borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 24 }}>ðŸ‘‘</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>1 Ð¡Ð°Ñ€Ñ‹Ð½ Ð±Ð°Ð³Ñ†</div>
                  <div style={{ fontSize: 12, color: "#e9d5ff" }}>Ð‘Ò¯Ñ… ÐºÐ¸Ð½Ð¾ â€” Ñ…ÑÐ·Ð³Ð°Ð°Ñ€Ð³Ò¯Ð¹ Ò¯Ð·ÑÑ…</div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#fff" }}>12,500â‚®</div>
                <div style={{ fontSize: 11, color: "#e9d5ff" }}>/ ÑÐ°Ñ€</div>
              </div>
            </div>
          </div>
        )}
        {loading
          ? <div style={{ textAlign: "center", padding: 40, color: C.muted }}>ÐÑ‡Ð°Ð°Ð»Ð»Ð°Ð¶ Ð±Ð°Ð¹Ð½Ð°...</div>
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
  const mainUrl = film.url ? film.url.split("|||")[0] : "";
  const { type, src } = getVideoEmbed(mainUrl);
  useEffect(() => {
    const t = setTimeout(() => setShowControls(false), 4000);
    // 2 pushState Ñ…Ð¸Ð¹Ð½Ñ â€” Ð½ÑÐ³ Ð±ÑƒÑ†Ð°Ñ…Ð°Ð´ video Ð´Ð¾Ñ‚Ð¾Ñ€ Ò¯Ð»Ð´ÑÐ½Ñ, Ñ…Ð¾Ñ‘Ñ€ Ð´Ð°Ñ…Ð¸Ð½Ð´ Ð½ÑŒ Ð³Ð°Ñ€Ð½Ð°
    window.history.pushState({ video: true }, "");
    window.history.pushState({ video: true }, "");
    const handlePop = () => {
      // Ð”Ð°Ñ…Ð¸Ð½ Ð½ÑÐ³ pushState Ð½ÑÐ¼Ð¶ Ð±ÑƒÑ†Ð°Ñ… Ð´Ð°Ñ€Ð°Ñ…Ð°Ð´ ÑÐ°Ð¹Ñ‚Ð°Ð°Ñ Ð³Ð°Ñ€Ð°Ñ…Ð³Ò¯Ð¹ Ð±Ð¾Ð»Ð³Ð¾Ð½Ð¾
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: C.muted, fontSize: 14 }}>Ð’Ð¸Ð´ÐµÐ¾ Ñ…Ð¾Ð»Ð±Ð¾Ð¾Ñ Ð±Ð°Ð¹Ñ…Ð³Ò¯Ð¹ Ð±Ð°Ð¹Ð½Ð°</div>
      )}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, background: "linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)", padding: "16px", transition: "opacity 0.3s", opacity: showControls ? 1 : 0, pointerEvents: showControls ? "auto" : "none" }}>
        <button onClick={(e) => { e.stopPropagation(); onBack(); }} style={{ background: "rgba(0,0,0,0.5)", border: "none", color: "#fff", fontSize: 22, cursor: "pointer", borderRadius: 50, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(10px)" }}>â†</button>
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
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.muted, fontSize: 22, cursor: "pointer" }}>â†</button>
        <input autoFocus value={q} onChange={(e: any) => setQ(e.target.value)} placeholder="ÐšÐ¸Ð½Ð¾ Ñ…Ð°Ð¹Ñ…..." style={{ ...inputSt, flex: 1 }} />
      </div>
      <div style={{ padding: "12px 14px" }}>
        {q && res.length === 0 && <p style={{ color: C.muted, textAlign: "center", marginTop: 40 }}>ÐžÐ»Ð´ÑÐ¾Ð½Ð³Ò¯Ð¹</p>}
        {res.map((f: any) => (
          <div key={f.id} onClick={() => onFilm(f)} style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 0", borderBottom: `0.5px solid ${C.bd}`, cursor: "pointer" }}>
            <div style={{ width: 44, height: 60, borderRadius: 6, background: f.bg || "#1a0820", flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {f.img ? <img src={f.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 20 }}>ðŸŽ¬</span>}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.txt }}>{f.title}</div>
              <div style={{ fontSize: 12, color: f.free ? C.green : C.gold, marginTop: 3 }}>{f.free ? "Ò®Ð½ÑÐ³Ò¯Ð¹" : `${f.price?.toLocaleString()}â‚®`}</div>
            </div>
            {!f.free && f.locked && <span style={{ fontSize: 16 }}>ðŸ”’</span>}
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
      <div style={{ fontSize: 40, marginBottom: 12 }}>ðŸ”</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: C.txt, marginBottom: 20 }}>ÐÐ´Ð¼Ð¸Ð½ Ð½ÑÐ²Ñ‚Ñ€ÑÑ…</div>
      <div style={{ width: "100%", maxWidth: 320 }}>
        <input type="password" value={key} onChange={(e: any) => setKey(e.target.value)} placeholder="ÐÑƒÑƒÑ† ÐºÐ¾Ð´" style={inputSt} onKeyDown={(e: any) => e.key === "Enter" && go()} />
        {err && <p style={{ color: "#f05555", fontSize: 12, marginTop: 6 }}>ÐÑƒÑƒÑ† ÐºÐ¾Ð´ Ð±ÑƒÑ€ÑƒÑƒ Ð±Ð°Ð¹Ð½Ð°</p>}
        <button onClick={go} style={{ ...goldBtn, marginTop: 12 }}>ÐÑÐ²Ñ‚Ñ€ÑÑ…</button>
        <button onClick={onBack} style={{ width: "100%", background: "none", border: `0.5px solid ${C.bd}`, color: C.muted, padding: 12, borderRadius: 10, fontSize: 14, cursor: "pointer", marginTop: 8 }}>Ð‘ÑƒÑ†Ð°Ñ…</button>
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
  const [search, setSearch] = useState("");

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
    if (!window.confirm("Ð­Ñ€Ñ…Ð¸Ð¹Ð³ Ñ…Ð°ÑÐ°Ñ… ÑƒÑƒ?")) return;
    await dbFetch(`pending_payments?ref_code=eq.${ref_code}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "revoked" }),
    });
    await load();
  };

  const deleteOrder = async (id: number) => {
    if (!window.confirm("Ð—Ð°Ñ…Ð¸Ð°Ð»Ð³Ñ‹Ð³ Ð±Ò¯Ñ€Ð¼Ó©ÑÓ©Ð½ ÑƒÑÑ‚Ð³Ð°Ñ… ÑƒÑƒ?")) return;
    await dbFetch(`pending_payments?id=eq.${id}`, { method: "DELETE" });
    setOrders(os => os.filter(o => o.id !== id));
  };

  const getFilmTitle = (id: number) => id === 0 ? "ðŸ‘‘ Ð¡Ð°Ñ€Ñ‹Ð½ Ð±Ð°Ð³Ñ†" : films.find((f: any) => f.id === id)?.title || `#${id}`;
  const getPhone = (uid: number) => uid ? (users.find((u: any) => u.id === uid)?.phone || "â€”") : "â€”";
  const statusColor = (s: string) => s === "confirmed" ? C.green : s === "pending" ? C.gold : C.red;
  const statusLabel = (s: string) => s === "confirmed" ? "âœ… Ð‘Ð°Ñ‚Ð°Ð»Ð³Ð°Ð°Ð¶ÑÐ°Ð½" : s === "revoked" ? "ðŸš« Ð¥Ð°ÑÐ°Ð³Ð´ÑÐ°Ð½" : "â³ Ð¥Ò¯Ð»ÑÑÐ³Ð´ÑÐ¶ Ð±Ð°Ð¹Ð½Ð°";

  const filtered = orders.filter((o: any) => {
    if (filter === "all") { }
    else if (filter === "monthly") { if (o.plan !== "monthly") return false; }
    else { if (o.status !== filter) return false; }
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      const phone = getPhone(o.user_id).toLowerCase();
      const ref = (o.ref_code || "").toLowerCase();
      return phone.includes(s) || ref.includes(s);
    }
    return true;
  });

  const totalRevenue = orders.filter(o => o.status === "confirmed").reduce((s, o) => s + (o.amount || 0), 0);
  const pendingCount = orders.filter(o => o.status === "pending").length;
  const confirmedCount = orders.filter(o => o.status === "confirmed").length;
  const monthlyCount = orders.filter(o => o.plan === "monthly" && o.status === "confirmed").length;

  const filters: { key: typeof filter; label: string }[] = [
    { key: "all", label: `Ð‘Ò¯Ð³Ð´ ${orders.length}` },
    { key: "pending", label: `â³ ${pendingCount}` },
    { key: "confirmed", label: `âœ… ${confirmedCount}` },
    { key: "monthly", label: `ðŸ‘‘ ${monthlyCount}` },
    { key: "revoked", label: `ðŸš« Ð¥Ð°ÑÐ°Ð³Ð´ÑÐ°Ð½` },
  ];

  return (
    <div style={{ padding: "0 14px" }}>
      {/* Ð¡Ñ‚Ð°Ñ‚Ð¸ÑÑ‚Ð¸Ðº */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        <div style={{ background: "#052e16", border: `0.5px solid ${C.green}`, borderRadius: 10, padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: C.muted }}>ÐÐ¸Ð¹Ñ‚ Ð¾Ñ€Ð»Ð¾Ð³Ð¾</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.green }}>{totalRevenue.toLocaleString()}â‚®</div>
        </div>
        <div style={{ background: C.card2, border: `0.5px solid ${C.bd}`, borderRadius: 10, padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: C.muted }}>Ð¥Ò¯Ð»ÑÑÐ³Ð´ÑÐ¶ Ð±Ð°Ð¹Ð½Ð°</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.gold }}>{pendingCount} Ð·Ð°Ñ…Ð¸Ð°Ð»Ð³Ð°</div>
        </div>
      </div>

      {/* Filter Ñ‚Ð¾Ð²Ñ‡Ð½ÑƒÑƒÐ´ */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto", paddingBottom: 4 }}>
        {filters.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            style={{ flexShrink: 0, padding: "6px 12px", borderRadius: 8, border: "none", background: filter === f.key ? C.gold : C.card2, color: filter === f.key ? "#000" : C.muted, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            {f.label}
          </button>
        ))}
        <button onClick={load} style={{ flexShrink: 0, background: C.card2, border: `0.5px solid ${C.bd}`, borderRadius: 8, padding: "6px 12px", color: C.muted, fontSize: 12, cursor: "pointer" }}>ðŸ”„</button>
      </div>

      {/* Ð¥Ð°Ð¹Ð»Ñ‚ */}
      <input
        style={{ ...inputSt, marginBottom: 12 }}
        value={search}
        onChange={(e: any) => setSearch(e.target.value)}
        placeholder="ðŸ“ž Ð”ÑƒÐ³Ð°Ð°Ñ€ ÑÑÐ²ÑÐ» ðŸ”‘ KN ÐºÐ¾Ð´ Ñ…Ð°Ð¹Ñ…..."
      />

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: C.muted }}>ÐÑ‡Ð°Ð°Ð»Ð»Ð°Ð¶ Ð±Ð°Ð¹Ð½Ð°...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: C.muted }}>Ð—Ð°Ñ…Ð¸Ð°Ð»Ð³Ð° Ð±Ð°Ð¹Ñ…Ð³Ò¯Ð¹ Ð±Ð°Ð¹Ð½Ð°</div>
      ) : (
        filtered.map((o: any) => (
          <div key={o.id} style={{ background: C.card, border: `0.5px solid ${o.status === "pending" ? C.gold : o.status === "revoked" ? "#3a1a1a" : C.bd}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#fb923c", fontFamily: "monospace" }}>{o.ref_code}</div>
                <div style={{ fontSize: 12, color: C.txt, marginTop: 2 }}>{getFilmTitle(o.film_id)}</div>
                <div style={{ fontSize: 12, color: C.gold, marginTop: 2 }}>ðŸ“ž {getPhone(o.user_id)}</div>
                {o.plan === "monthly" && <div style={{ fontSize: 11, color: "#a855f7", marginTop: 2 }}>ðŸ‘‘ Ð¡Ð°Ñ€Ñ‹Ð½ Ð±Ð°Ð³Ñ†</div>}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.gold }}>{o.amount?.toLocaleString()}â‚®</div>
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
                  {confirming === o.ref_code ? "..." : "âœ… Ð‘Ð°Ñ‚Ð°Ð»Ð³Ð°Ð°Ð¶ÑƒÑƒÐ»Ð°Ñ…"}
                </button>
              )}
              {o.status === "confirmed" && (
                <button onClick={() => revokeOrder(o.ref_code)}
                  style={{ flex: 1, background: "#1a0a0a", border: `0.5px solid ${C.red}`, borderRadius: 8, padding: "8px", color: C.red, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  ðŸš« Ð­Ñ€Ñ… Ñ…Ð°ÑÐ°Ñ…
                </button>
              )}
              {o.status === "revoked" && (
                <div style={{ flex: 1, fontSize: 12, color: C.red, textAlign: "center", padding: "8px" }}>ðŸš« Ð¥Ð°ÑÐ°Ð³Ð´ÑÐ°Ð½</div>
              )}
              <button onClick={() => deleteOrder(o.id)}
                style={{ background: "#1a0a0a", border: `0.5px solid #333`, borderRadius: 8, padding: "8px 12px", color: "#555", fontSize: 14, cursor: "pointer" }}>
                ðŸ—‘ï¸
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
  const [allPayments, setAllPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [userPayments, setUserPayments] = useState<any[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [showRights, setShowRights] = useState(false);
  const [filterTab, setFilterTab] = useState<"all"|"monthly"|"film">("all");

  const load = async () => {
    setLoading(true);
    const [us, fl, pay] = await Promise.all([
      dbFetch("users?order=id.desc&select=*"),
      dbFetch("films?select=id,title"),
      dbFetch("pending_payments?status=eq.confirmed&select=user_id,film_id,plan,amount,created_at,ref_code"),
    ]);
    setUsers(Array.isArray(us) ? us : []);
    setFilms(Array.isArray(fl) ? fl : []);
    setAllPayments(Array.isArray(pay) ? pay : []);
    setLoading(false);
  };

  const hasMonthly = (userId: number) => allPayments.some(p => p.user_id === userId && p.plan === "monthly");
  const hasFilm = (userId: number) => allPayments.some(p => p.user_id === userId && p.plan !== "monthly");
  const activeCount = (userId: number) => allPayments.filter(p => p.user_id === userId).length;

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
    if (!window.confirm("Ð­Ð½Ñ ÑÑ€Ñ…Ð¸Ð¹Ð³ Ñ…Ð°ÑÐ°Ñ… ÑƒÑƒ?")) return;
    await dbFetch(`pending_payments?ref_code=eq.${ref_code}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "revoked" }),
    });
    setUserPayments(ps => ps.map(p => p.ref_code === ref_code ? { ...p, status: "revoked" } : p));
  };

  const deleteUser = async (id: number) => {
    if (!window.confirm("Ð¥ÑÑ€ÑÐ³Ð»ÑÐ³Ñ‡Ð¸Ð¹Ð³ ÑƒÑÑ‚Ð³Ð°Ñ… ÑƒÑƒ?")) return;
    await dbFetch(`users?id=eq.${id}`, { method: "DELETE" });
    setUsers(us => us.filter(u => u.id !== id));
    setSelected(null);
  };

  const getFilmName = (id: number) => id === 0 ? "ðŸ‘‘ Ð¡Ð°Ñ€Ñ‹Ð½ Ð±Ð°Ð³Ñ†" : films.find(f => f.id === id)?.title || `ÐšÐ¸Ð½Ð¾ #${id}`;
  const statusColor = (s: string) => s === "confirmed" ? C.green : s === "revoked" ? C.red : C.gold;
  const statusLabel = (s: string) => s === "confirmed" ? "âœ… Ð˜Ð´ÑÐ²Ñ…Ñ‚ÑÐ¹" : s === "revoked" ? "ðŸš« Ð¥Ð°ÑÐ°Ð³Ð´ÑÐ°Ð½" : "â³ Ð¥Ò¯Ð»ÑÑÐ³Ð´ÑÐ¶ Ð±Ð°Ð¹Ð½Ð°";
  const activePayments = userPayments.filter(p => p.status === "confirmed");

  if (selected) return (
    <div style={{ padding: "0 14px" }}>
      <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: C.muted, fontSize: 14, cursor: "pointer", marginBottom: 12 }}>â† Ð‘ÑƒÑ†Ð°Ñ…</button>
      
      {/* Ð“Ð¸ÑˆÒ¯Ò¯Ð½Ð¸Ð¹ Ð¼ÑÐ´ÑÑÐ»ÑÐ» */}
      <div style={{ background: C.card, border: `0.5px solid ${C.bd}`, borderRadius: 12, padding: 16, marginBottom: 14 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.gold, marginBottom: 4 }}>ðŸ“ž {selected.phone}</div>
        <div style={{ fontSize: 12, color: C.muted }}>ID: {selected.user_id}</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Ð‘Ò¯Ñ€Ñ‚Ð³ÑÐ³Ð´ÑÑÐ½: {new Date(selected.created_at || Date.now()).toLocaleDateString("mn-MN")}</div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={() => setShowRights(!showRights)} style={{ flex: 1, background: showRights ? C.blue : C.card2, border: `0.5px solid ${C.blue}`, borderRadius: 8, padding: "9px", color: showRights ? "#fff" : C.blue, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            ðŸŽ¬ ÐšÐ¸Ð½Ð¾ Ò¯Ð·ÑÑ… ÑÑ€Ñ… {loadingPayments ? "..." : `(${activePayments.length})`}
          </button>
          <button onClick={() => deleteUser(selected.id)} style={{ background: "#1a0a0a", border: `0.5px solid ${C.red}`, borderRadius: 8, padding: "9px 14px", color: C.red, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>ðŸ—‘ï¸</button>
        </div>
      </div>

      {/* Ð˜Ð´ÑÐ²Ñ…Ñ‚ÑÐ¹ ÑÑ€Ñ…Ò¯Ò¯Ð´ */}
      {showRights && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.txt, marginBottom: 10 }}>
            ðŸŽ¬ Ð˜Ð´ÑÐ²Ñ…Ñ‚ÑÐ¹ ÐºÐ¸Ð½Ð¾ ÑÑ€Ñ…Ò¯Ò¯Ð´
          </div>
          {loadingPayments ? (
            <div style={{ textAlign: "center", padding: 20, color: C.muted }}>ÐÑ‡Ð°Ð°Ð»Ð»Ð°Ð¶ Ð±Ð°Ð¹Ð½Ð°...</div>
          ) : activePayments.length === 0 ? (
            <div style={{ textAlign: "center", padding: 16, color: C.muted, background: C.card, borderRadius: 10 }}>Ð˜Ð´ÑÐ²Ñ…Ñ‚ÑÐ¹ ÑÑ€Ñ… Ð±Ð°Ð¹Ñ…Ð³Ò¯Ð¹</div>
          ) : activePayments.map(p => (
            <div key={p.id} style={{ background: C.card, border: `0.5px solid ${C.green}`, borderRadius: 12, padding: 14, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.txt }}>{getFilmName(p.film_id)}</div>
                <div style={{ fontSize: 11, color: C.green, marginTop: 2 }}>âœ… Ð˜Ð´ÑÐ²Ñ…Ñ‚ÑÐ¹ Â· {p.amount?.toLocaleString()}â‚®</div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{new Date(p.created_at).toLocaleString("mn-MN")}</div>
              </div>
              <button onClick={() => revokeAccess(p.ref_code)} style={{ background: "#1a0a0a", border: `0.5px solid ${C.red}`, borderRadius: 8, padding: "8px 12px", color: C.red, fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                ðŸš« Ð¥Ð°ÑÐ°Ñ…
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Ð‘Ò¯Ñ… Ð·Ð°Ñ…Ð¸Ð°Ð»Ð³Ñ‹Ð½ Ñ‚Ò¯Ò¯Ñ… */}
      <div style={{ fontSize: 13, fontWeight: 700, color: C.txt, marginBottom: 10 }}>Ð—Ð°Ñ…Ð¸Ð°Ð»Ð³Ñ‹Ð½ Ñ‚Ò¯Ò¯Ñ…</div>
      {loadingPayments ? (
        <div style={{ textAlign: "center", padding: 20, color: C.muted }}>ÐÑ‡Ð°Ð°Ð»Ð»Ð°Ð¶ Ð±Ð°Ð¹Ð½Ð°...</div>
      ) : userPayments.length === 0 ? (
        <div style={{ textAlign: "center", padding: 20, color: C.muted }}>Ð—Ð°Ñ…Ð¸Ð°Ð»Ð³Ð° Ð±Ð°Ð¹Ñ…Ð³Ò¯Ð¹</div>
      ) : userPayments.map(p => (
        <div key={p.id} style={{ background: C.card, border: `0.5px solid ${statusColor(p.status)}22`, borderRadius: 12, padding: 14, marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fb923c", fontFamily: "monospace" }}>{p.ref_code}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{getFilmName(p.film_id)}</div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{new Date(p.created_at).toLocaleString("mn-MN")}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.gold }}>{p.amount?.toLocaleString()}â‚®</div>
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
        <span style={{ fontSize: 13, color: C.muted }}>{users.length} Ð³Ð¸ÑˆÒ¯Ò¯Ð½</span>
        <button onClick={load} style={{ background: C.card2, border: `0.5px solid ${C.bd}`, borderRadius: 8, padding: "6px 12px", color: C.muted, fontSize: 12, cursor: "pointer" }}>ðŸ”„ Ð¨Ð¸Ð½ÑÑ‡Ð»ÑÑ…</button>
      </div>

      {/* Filter */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {([["all","Ð‘Ò¯Ð³Ð´"],["monthly","ðŸ‘‘ Ð¡Ð°Ñ€Ñ‹Ð½"],["film","ðŸŽ¬ ÐšÐ¸Ð½Ð¾"]] as any[]).map(([k,l]) => (
          <button key={k} onClick={() => setFilterTab(k)}
            style={{ flex: 1, padding: "7px", borderRadius: 8, border: "none", background: filterTab === k ? C.gold : C.card2, color: filterTab === k ? "#000" : C.muted, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: C.muted }}>ÐÑ‡Ð°Ð°Ð»Ð»Ð°Ð¶ Ð±Ð°Ð¹Ð½Ð°...</div>
      ) : users.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: C.muted }}>Ð“Ð¸ÑˆÒ¯Ò¯Ð½ Ð±Ð°Ð¹Ñ…Ð³Ò¯Ð¹ Ð±Ð°Ð¹Ð½Ð°</div>
      ) : (
        users
          .filter(u => {
            if (filterTab === "monthly") return hasMonthly(u.id);
            if (filterTab === "film") return hasFilm(u.id) && !hasMonthly(u.id);
            return true;
          })
          .map(u => (
          <div key={u.id} onClick={() => openUser(u)} style={{ background: C.card, border: `0.5px solid ${activeCount(u.id) > 0 ? C.green : C.bd}`, borderRadius: 12, padding: 14, marginBottom: 10, cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.gold }}>ðŸ“ž {u.phone}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>ID: {u.user_id} Â· {new Date(u.created_at || Date.now()).toLocaleDateString("mn-MN")}</div>
                <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                  {hasMonthly(u.id) && <span style={{ background: "#3b0764", border: `0.5px solid #a855f7`, borderRadius: 6, padding: "2px 8px", fontSize: 11, color: "#e9d5ff", fontWeight: 700 }}>ðŸ‘‘ Ð¡Ð°Ñ€Ñ‹Ð½ ÑÑ€Ñ…</span>}
                  {hasFilm(u.id) && <span style={{ background: "#052e16", border: `0.5px solid ${C.green}`, borderRadius: 6, padding: "2px 8px", fontSize: 11, color: C.green, fontWeight: 700 }}>ðŸŽ¬ {allPayments.filter(p => p.user_id === u.id && p.plan !== "monthly").length} ÐºÐ¸Ð½Ð¾</span>}
                  {!hasMonthly(u.id) && !hasFilm(u.id) && <span style={{ fontSize: 11, color: C.muted }}>Ð­Ñ€Ñ…Ð³Ò¯Ð¹</span>}
                </div>
              </div>
              <span style={{ color: C.muted, fontSize: 16 }}>â€º</span>
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
    if (!window.confirm("Ð‘Ò¯Ñ… Ñ‡Ð°Ñ‚Ñ‹Ð³ ÑƒÑÑ‚Ð³Ð°Ñ… ÑƒÑƒ?")) return;
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
        <span style={{ fontSize: 13, color: C.muted }}>{msgs.filter(m => !m.read).length} ÑˆÐ¸Ð½Ñ Â· {msgs.length} Ð½Ð¸Ð¹Ñ‚</span>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={load} style={{ background: C.card2, border: `0.5px solid ${C.bd}`, borderRadius: 8, padding: "6px 12px", color: C.muted, fontSize: 12, cursor: "pointer" }}>ðŸ”„</button>
          <button onClick={deleteAll} style={{ background: "#1a0a0a", border: `0.5px solid ${C.red}`, borderRadius: 8, padding: "6px 12px", color: C.red, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>ðŸ—‘ï¸ Ð‘Ò¯Ð³Ð´Ð¸Ð¹Ð³ ÑƒÑÑ‚Ð³Ð°Ñ…</button>
        </div>
      </div>
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: C.muted }}>ÐÑ‡Ð°Ð°Ð»Ð»Ð°Ð¶ Ð±Ð°Ð¹Ð½Ð°...</div>
      ) : msgs.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: C.muted }}>ÐœÐµÑÑÐµÐ¶ Ð±Ð°Ð¹Ñ…Ð³Ò¯Ð¹ Ð±Ð°Ð¹Ð½Ð°</div>
      ) : (
        msgs.map(m => (
          <div key={m.id} style={{ background: C.card, border: `0.5px solid ${m.read ? C.bd : C.gold}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.gold }}>ðŸ“ž {m.phone}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{new Date(m.created_at).toLocaleString("mn-MN")}</div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {!m.read && <span style={{ fontSize: 11, background: C.gold, color: "#000", borderRadius: 6, padding: "2px 8px", fontWeight: 700 }}>Ð¨Ð¸Ð½Ñ</span>}
                <button onClick={() => deleteOne(m.id)} style={{ background: "none", border: "none", color: C.red, fontSize: 14, cursor: "pointer" }}>ðŸ—‘ï¸</button>
              </div>
            </div>
            {/* Ð¥ÑÑ€ÑÐ³Ð»ÑÐ³Ñ‡Ð¸Ð¹Ð½ Ð¼ÐµÑÑÐµÐ¶ */}
            <div style={{ fontSize: 13, color: C.txt, background: C.card2, borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>{m.message}</div>
            {/* Ð¥Ð°Ñ€Ð¸Ñƒ Ð±Ð°Ð¹Ð²Ð°Ð» Ñ…Ð°Ñ€ÑƒÑƒÐ»Ð°Ñ… */}
            {m.reply && (
              <div style={{ background: "#0a1628", border: `0.5px solid ${C.blue}`, borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
                <div style={{ fontSize: 10, color: C.blue, marginBottom: 4, fontWeight: 700 }}>ÐÐ”ÐœÐ˜ÐÐ« Ð¥ÐÐ Ð˜Ð£</div>
                <div style={{ fontSize: 13, color: C.txt }}>{m.reply}</div>
              </div>
            )}
            {/* Ð¥Ð°Ñ€Ð¸Ñƒ Ð±Ð¸Ñ‡Ð¸Ñ… */}
            {replyId === m.id ? (
              <div>
                <textarea
                  value={replyText}
                  onChange={(e: any) => setReplyText(e.target.value)}
                  placeholder="Ð¥Ð°Ñ€Ð¸Ñƒ Ð±Ð¸Ñ‡Ð½Ñ Ò¯Ò¯..."
                  style={{ ...inputSt, height: 80, resize: "none", lineHeight: 1.5, marginBottom: 8 }}
                  autoFocus
                />
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => sendReply(m.id)} disabled={sending || !replyText.trim()}
                    style={{ flex: 1, background: C.blue, border: "none", borderRadius: 8, padding: "9px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: sending ? 0.6 : 1 }}>
                    {sending ? "Ð˜Ð»Ð³ÑÑÐ¶ Ð±Ð°Ð¹Ð½Ð°..." : "ðŸ“¨ Ð¥Ð°Ñ€Ð¸Ñƒ Ð¸Ð»Ð³ÑÑÑ…"}
                  </button>
                  <button onClick={() => { setReplyId(null); setReplyText(""); }}
                    style={{ background: C.card2, border: `0.5px solid ${C.bd}`, borderRadius: 8, padding: "9px 14px", color: C.muted, fontSize: 12, cursor: "pointer" }}>Ð¦ÑƒÑ†Ð»Ð°Ñ…</button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => { setReplyId(m.id); setReplyText(""); }}
                  style={{ flex: 1, background: C.card2, border: `0.5px solid ${C.blue}`, borderRadius: 8, padding: "8px", color: C.blue, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  ðŸ’¬ {m.reply ? "Ð”Ð°Ñ…Ð¸Ð½ Ñ…Ð°Ñ€Ð¸ÑƒÐ»Ð°Ñ…" : "Ð¥Ð°Ñ€Ð¸ÑƒÐ»Ð°Ñ…"}
                </button>
                {!m.read && (
                  <button onClick={() => markRead(m.id)}
                    style={{ background: "#166534", border: "none", borderRadius: 8, padding: "8px 14px", color: "#4ade80", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    âœ… Ð£Ð½ÑˆÑÐ°Ð½
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
  const mainUrl = f.url ? f.url.split("|||")[0] : "";
  const existingPreview = f.url && f.url.includes("|||") ? f.url.split("|||")[1] : "";
  const [title, setTitle] = useState(f.title);
  const [price, setPrice] = useState(String(f.price || 5000));
  const [op, setOp] = useState(String(f.op || 6000));
  const [url, setUrl] = useState(mainUrl);
  const [img, setImg] = useState(f.img || "");
  const [previewUrl, setPreviewUrl] = useState(existingPreview);
  const [badge, setBadge] = useState(f.badge || "Ð¥ÑÐ»Ñ‚ÑÐ¹");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const combinedUrl = previewUrl ? `${url}|||${previewUrl}` : url;
    const payload: any = { title, price: parseInt(price) || 0, op: parseInt(op) || 0, url: combinedUrl, badge };
    if (img) payload.img = img;
    await dbFetch(`films?id=eq.${f.id}`, { method: "PATCH", body: JSON.stringify(payload) });
    setSaving(false);
    onDone();
  };

  return (
    <div style={{ marginTop: 10, borderTop: `0.5px solid ${C.bd}`, paddingTop: 10 }}>
      <label style={lbl}>Ð“Ð°Ñ€Ñ‡Ð¸Ð³</label>
      <input style={inputSt} value={title} onChange={(e: any) => setTitle(e.target.value)} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
        <div>
          <label style={lbl}>Ð—Ð°Ñ€Ð°Ñ… Ò¯Ð½Ñ â‚®</label>
          <input style={inputSt} value={price} onChange={(e: any) => setPrice(e.target.value)} type="number" />
        </div>
        <div>
          <label style={lbl}>Ð¥ÑƒÑƒÑ‡Ð¸Ð½ Ò¯Ð½Ñ â‚®</label>
          <input style={inputSt} value={op} onChange={(e: any) => setOp(e.target.value)} type="number" />
        </div>
      </div>
      <label style={{ ...lbl, marginTop: 8 }}>Badge</label>
      <select style={inputSt} value={badge} onChange={(e: any) => setBadge(e.target.value)}>
        <option>Ð¥ÑÐ»Ñ‚ÑÐ¹</option>
        <option>Ð¥Ð°Ð´Ð¼Ð°Ð»</option>
      </select>
      <label style={{ ...lbl, marginTop: 8 }}>Ð’Ð¸Ð´ÐµÐ¾ URL</label>
      <input style={inputSt} value={url} onChange={(e: any) => setUrl(e.target.value)} placeholder="https://iframe.mediadelivery.net/..." />
      <label style={{ ...lbl, marginTop: 8 }}>ðŸŽ¬ Preview URL (Bunny.net MP4)</label>
      <input style={inputSt} value={previewUrl} onChange={(e: any) => setPreviewUrl(e.target.value)} placeholder="https://your.b-cdn.net/preview.mp4" />
      <label style={{ ...lbl, marginTop: 8 }}>Ð—ÑƒÑ€Ð³Ð¸Ð¹Ð½ URL ÑÑÐ²ÑÐ» Ñ„Ð°Ð¹Ð»</label>
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
          {saving ? "..." : "âœ… Ð¥Ð°Ð´Ð³Ð°Ð»Ð°Ñ…"}
        </button>
        <button onClick={onDone} style={{ flex: 1, background: C.card2, border: `0.5px solid ${C.bd}`, borderRadius: 8, padding: "10px", color: C.muted, fontSize: 13, cursor: "pointer" }}>Ð‘Ð¾Ð»Ð¸Ñ…</button>
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

  // Unread Ñ‚Ð¾Ð¾ Ð°Ñ‡Ð°Ð°Ð»Ð»Ð°Ñ… + 30 ÑÐµÐºÑƒÐ½Ð´ Ñ‚ÑƒÑ‚Ð°Ð¼Ð´ ÑˆÐ¸Ð½ÑÑ‡Ð»ÑÑ…
  useEffect(() => {
    const fetchUnread = async () => {
      const data = await dbFetch("contact_messages?read=eq.false&select=id");
      setUnreadCount(Array.isArray(data) ? data.length : 0);
    };
    fetchUnread();
    const t = setInterval(fetchUnread, 30000);
    return () => clearInterval(t);
  }, [tab]);
  const empty = { title: "", views: 0, op: 6000, price: 4000, badge: "Ð¥ÑÐ»Ñ‚ÑÐ¹", free: false, locked: true, url: "", img: "", bg: "#1a0820" };
  const [form, setForm] = useState<any>(empty);
  const set = (k: string) => (e: any) => setForm((f: any) => ({ ...f, [k]: e.target.value }));
  const setChk = (k: string) => (e: any) => setForm((f: any) => ({ ...f, [k]: e.target.checked }));
  const save = async () => {
    if (!form.title.trim()) { alert("Ð“Ð°Ñ€Ñ‡Ð¸Ð³ Ð¾Ñ€ÑƒÑƒÐ»Ð½Ð° ÑƒÑƒ"); return; }
    setSaving(true);
    await dbFetch("films", { method: "POST", body: JSON.stringify({ ...form, views: parseInt(form.views) || 0, op: parseInt(form.op) || 6000, price: parseInt(form.price) || 0 }) });
    setSaving(false); setForm(empty); setTab("list"); onRefresh();
  };
  const deletFilm = async (id: number) => {
    if (!window.confirm("Ð£ÑÑ‚Ð³Ð°Ñ… ÑƒÑƒ?")) return;
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
          <button onClick={onBack} style={{ background: "none", border: "none", color: C.muted, fontSize: 22, cursor: "pointer" }}>â†</button>
          <span style={{ fontSize: 15, fontWeight: 700, color: C.txt }}>ÐšÐ¸Ð½Ð¾ ÑƒÐ´Ð¸Ñ€Ð´Ð°Ñ…</span>
        </div>
        <span style={{ fontSize: 12, color: C.muted }}>{films.length} ÐºÐ¸Ð½Ð¾</span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", padding: "10px 14px", gap: 6 }}>
        <button onClick={() => setTab("list")} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: tab === "list" ? C.gold : C.card2, color: tab === "list" ? "#000" : C.muted, fontWeight: 700, cursor: "pointer", fontSize: 11 }}>ðŸ“‹ Ð–Ð°Ð³ÑÐ°Ð°Ð»Ñ‚</button>
        <button onClick={() => setTab("orders")} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: tab === "orders" ? C.gold : C.card2, color: tab === "orders" ? "#000" : C.muted, fontWeight: 700, cursor: "pointer", fontSize: 11 }}>ðŸ§¾ Ð—Ð°Ñ…Ð¸Ð°Ð»Ð³Ð°</button>
        <button onClick={() => setTab("members")} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: tab === "members" ? C.gold : C.card2, color: tab === "members" ? "#000" : C.muted, fontWeight: 700, cursor: "pointer", fontSize: 11 }}>ðŸ‘¥ Ð“Ð¸ÑˆÒ¯Ò¯Ð´</button>
        <button onClick={() => setTab("add")} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: tab === "add" ? C.gold : C.card2, color: tab === "add" ? "#000" : C.muted, fontWeight: 700, cursor: "pointer", fontSize: 11 }}>âž• ÐÑÐ¼ÑÑ…</button>
        <button onClick={() => { setTab("sms"); setUnreadCount(0); }} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: tab === "sms" ? C.gold : C.card2, color: tab === "sms" ? "#000" : C.muted, fontWeight: 700, cursor: "pointer", fontSize: 11, position: "relative" }}>
          ðŸ’¬ Ð¥Ð¾Ð»Ð±Ð¾Ð³Ð´Ð¾Ñ…
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
            <label style={lbl}>Ð“Ð°Ñ€Ñ‡Ð¸Ð³ *</label>
            <input style={inputSt} value={form.title} onChange={set("title")} placeholder="ÐšÐ¸Ð½Ð¾ Ð½ÑÑ€" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
              <div><label style={lbl}>Ò®Ð·ÑÑÐ½ Ñ‚Ð¾Ð¾</label><input style={inputSt} value={form.views} onChange={set("views")} type="number" /></div>
              <div><label style={lbl}>Badge</label>
                <select style={inputSt} value={form.badge} onChange={set("badge")}><option>Ð¥ÑÐ»Ñ‚ÑÐ¹</option><option>Ð¥Ð°Ð´Ð¼Ð°Ð»</option></select>
              </div>
              <div><label style={lbl}>Ð¥ÑƒÑƒÑ‡Ð¸Ð½ Ò¯Ð½Ñ â‚®</label><input style={inputSt} value={form.op} onChange={set("op")} type="number" /></div>
              <div><label style={lbl}>Ð—Ð°Ñ€Ð°Ñ… Ò¯Ð½Ñ â‚®</label><input style={inputSt} value={form.price} onChange={set("price")} type="number" /></div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, padding: "10px", background: C.card2, borderRadius: 8 }}>
              <input type="checkbox" id="cb-free" checked={form.free} onChange={setChk("free")} style={{ width: 18, height: 18 }} />
              <label htmlFor="cb-free" style={{ fontSize: 14, color: C.txt, cursor: "pointer" }}>ðŸ†“ Ò®Ð½ÑÐ³Ò¯Ð¹ ÐºÐ¸Ð½Ð¾</label>
            </div>
            <label style={{ ...lbl, marginTop: 12 }}>Ð’Ð¸Ð´ÐµÐ¾ URL (YouTube / MP4 / Google Drive)</label>
            <input style={inputSt} value={form.url} onChange={set("url")} placeholder="https://youtu.be/... ÑÑÐ²ÑÐ» .mp4 Ñ…Ð¾Ð»Ð±Ð¾Ð¾Ñ" />
            <label style={{ ...lbl, marginTop: 10 }}>ðŸŽ¬ Preview URL (Bunny.net MP4)</label>
            <input style={inputSt} value={form.preview_url || ""} onChange={set("preview_url")} placeholder="https://your.b-cdn.net/preview.mp4" />
            <label style={{ ...lbl, marginTop: 10 }}>Ð—ÑƒÑ€Ð³Ð¸Ð¹Ð½ URL ÑÑÐ²ÑÐ» Ñ„Ð°Ð¹Ð»</label>
            <input style={inputSt} value={form.img} onChange={set("img")} placeholder="https://..." />
            <input type="file" accept="image/*" onChange={(e: any) => {
              const file = e.target.files?.[0]; if (!file) return;
              const reader = new FileReader();
              reader.onload = (ev: any) => setForm((f: any) => ({ ...f, img: ev.target.result }));
              reader.readAsDataURL(file);
            }} style={{ marginTop: 6, fontSize: 12, color: C.muted, width: "100%" }} />
            <button onClick={save} disabled={saving} style={{ ...goldBtn, marginTop: 16, opacity: saving ? 0.6 : 1 }}>
              {saving ? "Ð¥Ð°Ð´Ð³Ð°Ð»Ð¶ Ð±Ð°Ð¹Ð½Ð°..." : "âœ… Ð¥Ð°Ð´Ð³Ð°Ð»Ð°Ñ…"}
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
                  {f.img ? <img src={f.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 20 }}>ðŸŽ¬</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.txt, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.title}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{f.badge} Â· {f.free ? "Ò®Ð½ÑÐ³Ò¯Ð¹" : `${f.price?.toLocaleString()}â‚®`} Â· {f.views} Ò¯Ð·ÑÑÐ½</div>
                  <div style={{ fontSize: 11, marginTop: 2, color: f.locked ? C.red : C.green }}>{f.locked ? "ðŸ”’ Ð¥Ð°Ð°Ð»Ñ‚Ñ‚Ð°Ð¹" : "ðŸ”“ ÐÑÑÐ»Ñ‚Ñ‚ÑÐ¹"}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => toggleLock(f)} style={{ flex: 1, padding: "8px 4px", borderRadius: 8, border: `0.5px solid ${C.bd}`, background: f.locked ? "#166534" : "#7f1d1d", color: f.locked ? "#4ade80" : "#f87171", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  {f.locked ? "ðŸ”“ ÐÑÑÑ…" : "ðŸ”’ Ð¥Ð°Ð°Ñ…"}
                </button>
                <button onClick={() => setEditId(editId === f.id ? null : f.id)} style={{ flex: 1, padding: "8px 4px", borderRadius: 8, border: `0.5px solid ${C.bd}`, background: C.card2, color: C.muted, fontSize: 12, cursor: "pointer" }}>âœï¸ Ð—Ð°ÑÐ°Ñ…</button>
                <button onClick={() => deletFilm(f.id)} style={{ padding: "8px 12px", borderRadius: 8, border: `0.5px solid #3a1a1a`, background: "#1a0a0a", color: "#f05555", fontSize: 12, cursor: "pointer" }}>ðŸ—‘ï¸</button>
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
  const [pwaPrompt, setPwaPrompt] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [showLoginModal, setShowLoginModal] = useState(true);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const [accessMap, setAccessMap] = useState<Record<string, number>>({});

  // PWA install prompt Ð±Ð°Ñ€Ð¸Ñ…
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setPwaPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler as any);
    return () => window.removeEventListener('beforeinstallprompt', handler as any);
  }, []);

  const handleInstallClick = () => {
    const prompt = pwaPrompt || (window as any).__pwaPrompt;
    if (prompt) {
      prompt.prompt();
      prompt.userChoice.then(() => {
        setPwaPrompt(null);
        (window as any).__pwaPrompt = null;
      });
    } else {
      setShowInstall(true);
    }
  };

  useEffect(() => {
    const s = loadSession(); if (s) { setUser(s); syncAccessFromDB(s.id); }
    // localStorage-Ñ access map ÑƒÐ½ÑˆÐ¸Ð½Ð°
    try { const a = JSON.parse(localStorage.getItem("kino_access") || "{}"); setAccessMap(a); } catch {}
  }, []);

  // DB-Ñ confirmed Ñ‚Ó©Ð»Ð±Ó©Ñ€Ò¯Ò¯Ð´Ð¸Ð¹Ð³ Ñ‚Ð°Ñ‚Ð°Ð¶ access Ð¾Ð»Ð³Ð¾Ñ…
  const syncAccessFromDB = async (userId: number) => {
    // Ð‘Ò¯Ñ… Ð·Ð°Ñ…Ð¸Ð°Ð»Ð³Ñ‹Ð³ Ñ‚Ð°Ñ‚Ð°Ñ… (confirmed + revoked)
    const payments = await dbFetch(
      `pending_payments?user_id=eq.${userId}&select=film_id,plan,created_at,status`
    );
    if (!Array.isArray(payments)) return;
    const now = Date.now();
    const newAccess: Record<string, number> = {};

    payments.forEach((p: any) => {
      if (p.status !== "confirmed") return; // revoked Ð±Ð¾Ð»Ð¾Ð½ pending-Ð³ Ð¾Ñ€Ñ…Ð¸Ð½Ð¾
      if (p.plan === "monthly") {
        const exp = new Date(p.created_at).getTime() + 30 * 24 * 60 * 60 * 1000;
        if (exp > now) newAccess["monthly"] = exp;
      } else {
        const exp = new Date(p.created_at).getTime() + 72 * 60 * 60 * 1000;
        if (exp > now) newAccess[`film_${p.film_id}`] = Math.max(newAccess[`film_${p.film_id}`] || 0, exp);
      }
    });

    // localStorage-Ð³ Ð±Ò¯Ñ€ÑÐ½ ÑÐ¾Ð»Ð¸Ñ… â€” revoked ÑÑ€Ñ…Ò¯Ò¯Ð´ Ð°Ð²Ñ‚Ð¾Ð¼Ð°Ñ‚Ð°Ð°Ñ€ Ð°Ñ€Ð¸Ð»Ð½Ð°
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
    if (!user) { setShowLoginModal(true); return; }
    if (!f.locked || hasAccess(f.id)) { setCurFilm({ ...f, locked: false }); setPage("video"); }
    else setPayFilm(f);
  };

  const handlePaid = () => {
    if (payFilm.monthly) {
      // 1 ÑÐ°Ñ€Ñ‹Ð½ ÑÑ€Ñ…
      saveAccess("monthly", Date.now() + 30 * 24 * 60 * 60 * 1000);
      setPayFilm(null);
      // Ð‘Ò¯Ñ… ÐºÐ¸Ð½Ð¾ Ð½ÑÑÐ»Ñ‚Ñ‚ÑÐ¹ Ð±Ð¾Ð»Ð½Ð¾ â€” Ð½Ò¯Ò¯Ñ€ Ñ…ÑƒÑƒÐ´Ð°Ñ Ñ€ÑƒÑƒ Ð±ÑƒÑ†Ð°Ñ…
      setPage("home");
    } else {
      // 72 Ñ†Ð°Ð³Ð¸Ð¹Ð½ ÑÑ€Ñ…
      const expires = Date.now() + 72 * 60 * 60 * 1000;
      saveAccess(`film_${payFilm.id}`, expires);
      setCurFilm({ ...payFilm, locked: false });
      setPayFilm(null);
      setPage("video");
    }
  };

  const handleLogin = (u: any) => { setUser(u); syncAccessFromDB(u.id); setShowLoginModal(false); setPage("home"); };
  const handleLogout = () => { clearSession(); setUser(null); };
  const filmsWithUnlock = films.map(f => hasAccess(f.id) ? { ...f, locked: false } : f);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "system-ui,sans-serif" }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#0d0d14;overflow-x:hidden}
        input,select,button,textarea{font-family:inherit}
        input:focus,select:focus,textarea:focus{outline:none;border-color:#e8a020!important}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:#0d0d14}
        ::-webkit-scrollbar-thumb{background:#1e1e2e;border-radius:4px}
        .film-grid{grid-template-columns:repeat(3,1fr)!important}
        @media(min-width:1100px){.film-grid{grid-template-columns:repeat(5,1fr)!important}}
        @media(max-width:600px){.film-grid{grid-template-columns:1fr 1fr!important}}
      `}</style>

      {page === "home" && <HomePage films={filmsWithUnlock} onFilm={handleFilm} onSearch={() => setPage("search")} onAdmin={() => setPage("adminlogin")} loading={loading} user={user} onLogin={handleLogin} onLogout={handleLogout} onOpenLogin={() => setShowLoginModal(true)} onMonthly={() => setPayFilm({ id: 0, title: "1 Ð¡Ð°Ñ€Ñ‹Ð½ Ð±Ð°Ð³Ñ†", price: 12500, monthly: true, locked: true })} onContact={() => setShowContact(true)} accessMap={accessMap} onInstall={handleInstallClick} />}
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
              <div style={{ fontSize: 16, fontWeight: 800, color: C.txt }}>ðŸ“² Ð£Ñ‚ÑÐ°Ð½Ð´ ÑÑƒÑƒÐ»Ð³Ð°Ñ… Ð·Ð°Ð°Ð²Ð°Ñ€</div>
              <button onClick={() => setShowInstall(false)} style={{ background: "none", border: "none", color: C.muted, fontSize: 24, cursor: "pointer" }}>âœ•</button>
            </div>
            <div style={{ background: C.card2, borderRadius: 12, padding: 16, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.gold, marginBottom: 10 }}>ðŸ¤– Android (Chrome)</div>
              <div style={{ fontSize: 13, color: C.txt, lineHeight: 1.8 }}>
                1. Chrome Ñ†ÑÑ <span style={{ color: C.gold, fontWeight: 700 }}>â‹®</span> Ð´Ð°Ñ€Ð½Ð°<br/>
                2. <span style={{ color: C.gold, fontWeight: 700 }}>"ÐÒ¯Ò¯Ñ€ Ð´ÑÐ»Ð³ÑÑ†ÑÐ½Ð´ Ð½ÑÐ¼ÑÑ…"</span> Ð´Ð°Ñ€Ð½Ð°<br/>
                3. <span style={{ color: C.gold, fontWeight: 700 }}>"Ð¡ÑƒÑƒÐ»Ð³Ð°Ñ…"</span> Ð´Ð°Ñ€Ð½Ð°
              </div>
            </div>
            <div style={{ background: C.card2, borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.blue, marginBottom: 10 }}>ðŸŽ iPhone (Safari)</div>
              <div style={{ fontSize: 13, color: C.txt, lineHeight: 1.8 }}>
                1. Safari Ð´ÑÑÑ€ Ð½ÑÑÐ½Ñ<br/>
                2. Share Ñ‚Ð¾Ð²Ñ‡ <span style={{ color: C.blue, fontWeight: 700 }}>â–¡â†‘</span> Ð´Ð°Ñ€Ð½Ð°<br/>
                3. <span style={{ color: C.blue, fontWeight: 700 }}>"Add to Home Screen"</span> Ð´Ð°Ñ€Ð½Ð°
              </div>
            </div>
          </div>
        </div>
      )}

      {/* â”€â”€ ÐÐ­Ð’Ð¢Ð Ð­Ð¥/Ð‘Ò®Ð Ð¢Ð“Ò®Ò®Ð›Ð­Ð¥ â€” Ð´ÑÐ»Ð³ÑÑ†Ð¸Ð¹Ð½ Ð³Ð¾Ð»Ð´ fixed, ÐºÐ¸Ð½Ð¾ scroll-Ð´ ÑÐ°Ð°Ð´ Ð±Ð¾Ð»Ð¾Ñ…Ð³Ò¯Ð¹ â”€â”€ */}
      {!user && mounted && createPortal(
        <div style={{ position:"fixed", top:"50%", left:"50%", transform:"translate(-50%,-50%)", zIndex:9999, width:"calc(100% - 24px)", maxWidth:500, pointerEvents:"none" }}>
          <div style={{
              pointerEvents:"all",
              background:"#0d0d18",
              borderRadius:20, padding:"22px 20px 28px",
              border:"1px solid #1e2d4a",
              boxShadow:"0 10px 50px rgba(0,40,255,0.2)",
            }}>
              <button onClick={() => setShowLoginModal(false)} style={{ position:"absolute", top:14, right:16, background:"none", border:"none", color:"#6b6a90", fontSize:22, cursor:"pointer" }}>âœ•</button>
              <div style={{ fontSize:15, fontWeight:700, color:C.txt, marginBottom:14, textAlign:"center", letterSpacing:"0.02em" }}>Ð£Ñ‚Ð°ÑÐ½Ñ‹ Ð´ÑƒÐ³Ð°Ð°Ñ€Ð°Ð° Ð¾Ñ€ÑƒÑƒÐ»Ð½Ð° ÑƒÑƒ</div>
              <LoginModal onLogin={(u:any) => { handleLogin(u); setShowLoginModal(false); }} />
            </div>
        </div>,
        document.body
      )}
    </div>
  );
}

