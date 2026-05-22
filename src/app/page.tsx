"use client";
import { useState, useRef, useEffect, useCallback } from "react";

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
// ══════ ТАНЫ ДАНСНЫ МЭДЭЭЛЭЛ — ЭНД ӨӨРЧИЛНӨ ══════
const MY_ACCOUNT = {
  number: "MN11000500 5402504824",
  bank: "Хаан банк",
  name: "Т.Жаргалбаяр",
};
// ════════════════════════════════════════════════════

function saveSession(user: any) { const s = { user, expires: Date.now() + 7 * 24 * 60 * 60 * 1000 }; localStorage.setItem("kino_session", JSON.stringify(s)); }
function loadSession() { try { const s = JSON.parse(localStorage.getItem("kino_session") || "{}"); if (s.user && s.expires > Date.now()) return s.user; localStorage.removeItem("kino_session"); } catch { } return null; }
function clearSession() { localStorage.removeItem("kino_session"); }
function genUserId(id: number) { return "#" + String(id).padStart(6, "0"); }
function genRef(filmId: number): string {
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `KN${filmId}${rand}`;
}

const C = {
  bg: "#0d0d14", card: "#13131c", card2: "#1a1a26", bd: "#1e1e2e",
  txt: "#f0eefa", muted: "#6b6a90",
  red: "#e8281e", gold: "#e8a020", green: "#16a34a", blue: "#2563eb", amber: "#ca8a04",
};
const badgeColor = (b: string) => b === "Хадмал" ? C.amber : C.blue;
const inputSt: any = { width: "100%", background: "#0d0d18", border: `0.5px solid #1e1e2e`, borderRadius: 8, padding: "11px 13px", color: "#f0eefa", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
const goldBtn: any = { width: "100%", background: C.gold, border: "none", color: "#000", padding: 13, borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
const lbl: any = { fontSize: 12, color: C.muted, display: "block", marginBottom: 5 };

// ══════════════════════════════════════════════
// ТӨЛБӨРИЙН MODAL — данс + гүйлгээний утга
// Автомат polling: SMS Forwarder webhook-оос шалгана
// ══════════════════════════════════════════════
function PayModal({ film, onClose, onPaid }: any) {
  const [refCode] = useState(() => genRef(film.id));
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<"waiting" | "checking" | "paid" | "timeout">("waiting");
  const intervalRef = useRef<any>(null);
  const timeoutRef = useRef<any>(null);

  // Supabase-д pending_payments үүсгэх
  useEffect(() => {
    dbFetch("pending_payments", {
      method: "POST",
      body: JSON.stringify({ ref_code: refCode, film_id: film.id, amount: film.price, status: "pending" }),
    });

    // 10 минут polling — confirmed болсон эсэх шалгана
    intervalRef.current = setInterval(async () => {
      const rows = await dbFetch(`pending_payments?ref_code=eq.${refCode}&select=status`);
      if (Array.isArray(rows) && rows[0]?.status === "confirmed") {
        clearInterval(intervalRef.current);
        clearTimeout(timeoutRef.current);
        setStatus("paid");
        setTimeout(() => onPaid(), 1500);
      }
    }, 4000); // 4 секунд тутамд шалгана

    // 10 минутын дараа timeout
    timeoutRef.current = setTimeout(() => {
      clearInterval(intervalRef.current);
      setStatus("timeout");
    }, 10 * 60 * 1000);

    return () => {
      clearInterval(intervalRef.current);
      clearTimeout(timeoutRef.current);
    };
  }, []);

  const copyRef = () => {
    navigator.clipboard.writeText(refCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (status === "paid") {
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.95)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.green }}>Төлбөр баталгаажлаа!</div>
          <div style={{ fontSize: 14, color: C.muted, marginTop: 8 }}>Кино эхэлж байна...</div>
        </div>
      </div>
    );
  }

  if (status === "timeout") {
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.95)", display: "flex", alignItems: "flex-end", zIndex: 200 }}>
        <div style={{ background: C.card, borderRadius: "18px 18px 0 0", padding: "24px 20px 40px", width: "100%", border: `0.5px solid ${C.bd}` }}>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>⏰</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.txt }}>Хугацаа дууслаа</div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>Төлбөр 10 минутын дотор баталгаажаагүй байна</div>
          </div>
          <button onClick={onClose} style={goldBtn}>Буцах</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.95)", display: "flex", alignItems: "flex-end", zIndex: 200 }}>
      <div style={{ background: C.card, borderRadius: "18px 18px 0 0", padding: "20px 20px 44px", width: "100%", border: `0.5px solid ${C.bd}` }}>

        {/* Гарчиг */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.txt }}>{film.title}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: C.gold, marginTop: 2 }}>{film.price?.toLocaleString()}₮</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, fontSize: 26, cursor: "pointer", lineHeight: 1 }}>✕</button>
        </div>

        {/* Дансны мэдээлэл */}
        <div style={{ background: "#0a0f1e", border: `0.5px solid #1e3a5f`, borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.07em" }}>Шилжүүлэх данс</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: C.muted }}>Банк</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.txt }}>{MY_ACCOUNT.bank}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: C.muted }}>Данс</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: C.txt, fontFamily: "monospace", letterSpacing: "0.05em" }}>{MY_ACCOUNT.number}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: C.muted }}>Нэр</span>
            <span style={{ fontSize: 13, color: C.txt }}>{MY_ACCOUNT.name}</span>
          </div>
        </div>

        {/* Гүйлгээний утга — хуулах товчтой */}
        <div style={{ background: "#0a1628", border: `1.5px solid ${C.gold}`, borderRadius: 14, padding: "14px 16px", marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.07em" }}>
            ⚠️ Гүйлгээний утга — заавал бичнэ
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: C.gold, letterSpacing: "0.1em", fontFamily: "monospace" }}>
              {refCode}
            </div>
            <button
              onClick={copyRef}
              style={{
                background: copied ? C.green : C.card2,
                border: `0.5px solid ${copied ? C.green : C.bd}`,
                color: copied ? "#fff" : C.muted,
                borderRadius: 8, padding: "8px 14px",
                fontSize: 12, fontWeight: 700, cursor: "pointer",
                transition: "all 0.2s", whiteSpace: "nowrap",
              }}
            >
              {copied ? "✓ Хуулагдлаа" : "📋 Хуулах"}
            </button>
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 8, lineHeight: 1.5 }}>
            Энэ кодыг гүйлгээний утга талбарт бичнэ үү
          </div>
        </div>

        {/* Хүлээж байгаа байдал */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: C.card2, borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
          <div style={{
            width: 10, height: 10, borderRadius: "50%", background: C.gold,
            animation: "pulse 1.5s ease-in-out infinite",
            flexShrink: 0,
          }} />
          <div>
            <div style={{ fontSize: 13, color: C.txt, fontWeight: 600 }}>Төлбөр хүлээж байна...</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Мөнгө шилжүүлсний дараа автоматаар нээгдэнэ</div>
          </div>
        </div>

        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>

        <button onClick={onClose} style={{ width: "100%", background: "none", border: `0.5px solid ${C.bd}`, color: C.muted, padding: 12, borderRadius: 10, fontSize: 14, cursor: "pointer" }}>Буцах</button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// ADMIN SMS TAB — pending жагсаалт + нэг товч
// ══════════════════════════════════════════════
function AdminSmsTab({ films }: { films: any[] }) {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const rows = await dbFetch("pending_payments?order=created_at.desc&limit=50&select=*");
    setPayments(Array.isArray(rows) ? rows : []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const confirm = async (refCode: string) => {
    await dbFetch(`pending_payments?ref_code=eq.${refCode}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "confirmed" }),
    });
    load();
  };

  const reject = async (refCode: string) => {
    await dbFetch(`pending_payments?ref_code=eq.${refCode}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "rejected" }),
    });
    load();
  };

  const filmName = (id: number) => films.find(f => f.id === id)?.title || `Кино #${id}`;

  const pending = payments.filter(p => p.status === "pending");
  const done = payments.filter(p => p.status !== "pending");

  return (
    <div style={{ padding: "0 14px" }}>

      {/* Хэрхэн ажиллуулах зааварчилгаа */}
      <div style={{ background: "#0a1628", border: `0.5px solid #1e3a5f`, borderRadius: 12, padding: 14, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#60a5fa", marginBottom: 8 }}>📱 SMS Forwarder тохируулга</div>
        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.8 }}>
          1. Play Store → <span style={{ color: C.txt }}>"SMS Forwarder"</span> апп татна<br />
          2. New Rule → HTTP POST<br />
          3. URL: <span style={{ color: C.gold, fontFamily: "monospace", fontSize: 11 }}>https://таны-сайт.vercel.app/api/sms</span><br />
          4. Filter: <span style={{ color: C.gold, fontFamily: "monospace" }}>Khan Bank</span><br />
          5. Body: <span style={{ color: C.gold, fontFamily: "monospace", fontSize: 11 }}>{`{"text":"[message]"}`}</span>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.txt }}>
          📩 Хүлээгдэж байгаа{pending.length > 0 && <span style={{ background: C.red, color: "#fff", borderRadius: 20, padding: "1px 8px", fontSize: 11, marginLeft: 8 }}>{pending.length}</span>}
        </div>
        <button onClick={load} style={{ background: C.card2, border: `0.5px solid ${C.bd}`, color: C.muted, borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>🔄 Шинэчлэх</button>
      </div>

      {loading && <div style={{ textAlign: "center", color: C.muted, padding: 20 }}>Ачааллаж байна...</div>}

      {!loading && pending.length === 0 && (
        <div style={{ textAlign: "center", color: C.muted, padding: 30, fontSize: 13 }}>Хүлээгдэж буй төлбөр байхгүй</div>
      )}

      {/* Хүлээгдэж буй төлбөрүүд */}
      {pending.map(p => (
        <div key={p.id} style={{ background: "#1c1400", border: `0.5px solid ${C.gold}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.txt, marginBottom: 4 }}>{filmName(p.film_id)}</div>
              <div style={{ fontSize: 12, color: C.muted }}>
                Код: <span style={{ color: C.gold, fontFamily: "monospace", fontWeight: 700 }}>{p.ref_code}</span>
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                Дүн: <span style={{ color: C.txt }}>{p.amount?.toLocaleString()}₮</span>
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                {new Date(p.created_at).toLocaleString("mn-MN")}
              </div>
            </div>
            <div style={{ background: "#2d1a00", border: `0.5px solid ${C.gold}`, borderRadius: 6, padding: "3px 10px", fontSize: 11, color: C.gold, fontWeight: 700 }}>⏳ Хүлээгдэж байна</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => confirm(p.ref_code)}
              style={{ flex: 1, background: "#166534", border: `0.5px solid #16a34a`, color: "#4ade80", padding: "10px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >
              ✅ Зөвшөөрөх
            </button>
            <button
              onClick={() => reject(p.ref_code)}
              style={{ flex: 1, background: "#7f1d1d", border: `0.5px solid #dc2626`, color: "#f87171", padding: "10px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >
              ❌ Татгалзах
            </button>
          </div>
        </div>
      ))}

      {/* Өмнөх төлбөрүүд */}
      {done.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>Өмнөх төлбөрүүд</div>
          {done.slice(0, 10).map(p => (
            <div key={p.id} style={{ background: C.card, border: `0.5px solid ${C.bd}`, borderRadius: 10, padding: "10px 12px", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 12, color: C.txt }}>{filmName(p.film_id)} · <span style={{ fontFamily: "monospace", color: C.gold }}>{p.ref_code}</span></div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{p.amount?.toLocaleString()}₮</div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: p.status === "confirmed" ? C.green : C.red }}>
                {p.status === "confirmed" ? "✅" : "❌"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function QRCanvas({ text }: { text: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const S = 140, N = 21, sz = Math.floor(S / N);
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, S, S); ctx.fillStyle = "#000";
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
        {film.img ? <img src={film.img} alt={film.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <div style={{ width: "100%", height: "100%", background: `linear-gradient(160deg,${film.bg || "#1a0820"} 0%,#000 100%)`, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 44 }}>🎬</span></div>}
        <div style={{ position: "absolute", top: 8, left: 8, background: badgeColor(film.badge), borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 700, color: "#fff" }}>{film.badge}</div>
        {!film.free && film.locked && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 28 }}>🔒</span></div>}
      </div>
      <div style={{ padding: "7px 8px 10px" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.txt, lineHeight: 1.3, marginBottom: 5 }}>{film.title}</div>
        {!film.free && <div style={{ fontSize: 10, color: C.muted, textDecoration: "line-through", marginBottom: 1 }}>{film.op?.toLocaleString()}₮</div>}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: film.free ? C.green : C.gold }}>{film.free ? "Үнэгүй" : `${film.price?.toLocaleString()}₮`}</span>
          {film.free ? <button style={{ background: C.green, border: "none", color: "#fff", borderRadius: 16, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>▶ Үзэх</button>
            : <button style={{ background: C.gold, border: "none", color: "#000", borderRadius: 16, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>💳</button>}
        </div>
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
            <button key={m} onClick={() => { setMode(m); setErr(""); }} style={{ flex: 1, padding: "8px 4px", borderRadius: 8, border: "none", background: mode === m ? C.gold : C.card2, color: mode === m ? "#000" : C.muted, fontWeight: 700, cursor: "pointer", fontSize: 11 }}>
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

function HomePage({ films, onFilm, onSearch, onAdmin, loading, user, onLogin, onLogout }: any) {
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
          <button onClick={onAdmin} style={{ background: C.card2, border: `0.5px solid ${C.bd}`, color: C.muted, cursor: "pointer", fontSize: 12, borderRadius: 8, padding: "6px 10px" }}>⚙️</button>
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
        <button onClick={(e) => { e.stopPropagation(); onBack(); }} style={{ background: "rgba(0,0,0,0.5)", border: "none", color: "#fff", fontSize: 22, cursor: "pointer", borderRadius: 50, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
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

function AdminPage({ films, onBack, onRefresh }: any) {
  const [tab, setTab] = useState<"list" | "add" | "sms">("sms");
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
        <button onClick={() => setTab("sms")} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: tab === "sms" ? C.gold : C.card2, color: tab === "sms" ? "#000" : C.muted, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>📩 Төлбөр</button>
        <button onClick={() => setTab("list")} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: tab === "list" ? C.gold : C.card2, color: tab === "list" ? "#000" : C.muted, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>📋 Жагсаалт</button>
        <button onClick={() => setTab("add")} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: tab === "add" ? C.gold : C.card2, color: tab === "add" ? "#000" : C.muted, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>➕ Нэмэх</button>
      </div>

      {tab === "sms" && <AdminSmsTab films={films} />}

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
            <label style={{ ...lbl, marginTop: 12 }}>Видео URL</label>
            <input style={inputSt} value={form.url} onChange={set("url")} placeholder="https://youtu.be/..." />
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
  const [adminAuth, setAdminAuth] = useState(false);
  const [unlockedIds, setUnlockedIds] = useState<number[]>([]);
  const [user, setUser] = useState<any>(null);

  useEffect(() => { const s = loadSession(); if (s) setUser(s); }, []);
  const loadFilms = async () => {
    setLoading(true);
    const data = await dbFetch("films?order=created_at.desc&select=*");
    setFilms(Array.isArray(data) ? data : []);
    setLoading(false);
  };
  useEffect(() => { loadFilms(); }, []);

  const handleFilm = (f: any) => {
    const unlocked = unlockedIds.includes(f.id);
    if (f.free || !f.locked || unlocked) { setCurFilm({ ...f, locked: false }); setPage("video"); }
    else setPayFilm(f);
  };
  const handlePaid = () => {
    if (!payFilm) return;
    setUnlockedIds(ids => [...ids, payFilm.id]);
    setCurFilm({ ...payFilm, locked: false });
    setPayFilm(null);
    setPage("video");
  };
  const handleLogin = (u: any) => { setUser(u); setPage("home"); };
  const handleLogout = () => { clearSession(); setUser(null); };
  const filmsWithUnlock = films.map(f => unlockedIds.includes(f.id) ? { ...f, locked: false } : f);

  return (
    <div style={{ maxWidth: 430, margin: "0 auto", fontFamily: "system-ui,sans-serif", background: C.bg }}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}html,body{background:#0d0d14}input,select,button,textarea{font-family:inherit}input:focus,select:focus,textarea:focus{outline:none;border-color:#e8a020!important}::-webkit-scrollbar{width:0}`}</style>
      {page === "home" && <HomePage films={filmsWithUnlock} onFilm={handleFilm} onSearch={() => setPage("search")} onAdmin={() => setPage("adminlogin")} loading={loading} user={user} onLogin={() => setPage("login")} onLogout={handleLogout} />}
      {page === "login" && <LoginPage onLogin={handleLogin} onBack={() => setPage("home")} />}
      {page === "video" && curFilm && <VideoPage film={curFilm} onBack={() => setPage("home")} />}
      {page === "search" && <SearchPage films={filmsWithUnlock} onFilm={handleFilm} onBack={() => setPage("home")} />}
      {page === "adminlogin" && <AdminLogin onEnter={() => { setAdminAuth(true); setPage("admin"); }} onBack={() => setPage("home")} />}
      {page === "admin" && adminAuth && <AdminPage films={films} onBack={() => setPage("home")} onRefresh={loadFilms} />}
      {payFilm && <PayModal film={payFilm} onClose={() => setPayFilm(null)} onPaid={handlePaid} />}
    </div>
  );
}
