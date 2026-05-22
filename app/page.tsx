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

function saveSession(user:any){const s={user,expires:Date.now()+7*24*60*60*1000};localStorage.setItem("kino_session",JSON.stringify(s));}
function loadSession(){try{const s=JSON.parse(localStorage.getItem("kino_session")||"{}");if(s.user&&s.expires>Date.now())return s.user;localStorage.removeItem("kino_session");}catch{}return null;}
function clearSession(){localStorage.removeItem("kino_session");}
function genUserId(id:number){return "#"+String(id).padStart(6,"0");}

const BANKS = [
  { id:"khanbank",  name:"Ð¥Ð°Ð°Ð½ Ð±Ð°Ð½Ðº",   color:"#00a651", icon:"ðŸ¦", deep:"khanbank://qpay?amount=" },
  { id:"golomt",    name:"Ð“Ð¾Ð»Ð¾Ð¼Ñ‚ Ð±Ð°Ð½Ðº", color:"#e4002b", icon:"ðŸ¦", deep:"golomtbank://qpay?amount=" },
  { id:"tdbbank",   name:"Ð¥ÐÐ¡ Ð±Ð°Ð½Ðº",    color:"#0033a0", icon:"ðŸ¦", deep:"tdb://qpay?amount=" },
  { id:"statebank", name:"Ð¢Ó©Ñ€Ð¸Ð¹Ð½ Ð±Ð°Ð½Ðº", color:"#2c5f9e", icon:"ðŸ¦", deep:"statebank://qpay?amount=" },
  { id:"mbank",     name:"Ðœ Ð±Ð°Ð½Ðº",      color:"#e8281e", icon:"ðŸ“±", deep:"mbank://qpay?amount=" },
  { id:"most",      name:"MOST",        color:"#6c3fa0", icon:"ðŸ“±", deep:"most://payment?amount=" },
  { id:"upoint",    name:"U-Point",     color:"#f97316", icon:"ðŸ“±", deep:"upoint://pay?amount=" },
  { id:"socialpay", name:"SocialPay",   color:"#0ea5e9", icon:"ðŸ“±", deep:"socialpay://payment?amount=" },
];

const C = {
  bg:"#0d0d14", card:"#13131c", card2:"#1a1a26", bd:"#1e1e2e",
  txt:"#f0eefa", muted:"#6b6a90",
  red:"#e8281e", gold:"#e8a020", green:"#16a34a", blue:"#2563eb", amber:"#ca8a04",
};

const badgeColor = (b:string) => b === "Ð¥Ð°Ð´Ð¼Ð°Ð»" ? C.amber : C.blue;

const inputSt:any = {
  width:"100%", background:"#0d0d18", border:`0.5px solid #1e1e2e`,
  borderRadius:8, padding:"11px 13px", color:"#f0eefa", fontSize:14,
  outline:"none", boxSizing:"border-box", fontFamily:"inherit",
};
const goldBtn:any = {
  width:"100%", background:C.gold, border:"none", color:"#000",
  padding:13, borderRadius:10, fontSize:15, fontWeight:700,
  cursor:"pointer", fontFamily:"inherit",
};
const lbl:any = { fontSize:12, color:C.muted, display:"block", marginBottom:5 };

function LoginPage({ onLogin, onBack }:any) {
  const [mode, setMode] = useState<"login"|"register"|"reset">("login");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const handler = (e: any) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);
  const installApp = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const r = await installPrompt.userChoice;
    if (r.outcome === "accepted") setInstalled(true);
  };

  const register = async () => {
    if (phone.length < 8) { setErr("Ð£Ñ‚Ð°ÑÐ½Ñ‹ Ð´ÑƒÐ³Ð°Ð°Ñ€ Ð±ÑƒÑ€ÑƒÑƒ Ð±Ð°Ð¹Ð½Ð°"); return; }
    if (pin.length !== 4 || !/^\d+$/.test(pin)) { setErr("PIN 4 Ð¾Ñ€Ð¾Ð½Ñ‚Ð¾Ð¹ Ñ‚Ð¾Ð¾ Ð±Ð°Ð¹Ñ… Ñ‘ÑÑ‚Ð¾Ð¹"); return; }
    if (pin !== pin2) { setErr("PIN Ñ‚Ð°Ð°Ñ€Ð°Ñ…Ð³Ò¯Ð¹ Ð±Ð°Ð¹Ð½Ð°"); return; }
    setLoading(true); setErr("");
    const exists = await dbFetch(`users?phone=eq.${phone}&select=id`);
    if (Array.isArray(exists) && exists.length > 0) { setErr("Ð­Ð½Ñ Ð´ÑƒÐ³Ð°Ð°Ñ€ Ð±Ò¯Ñ€Ñ‚Ð³ÑÐ»Ñ‚ÑÐ¹ Ð±Ð°Ð¹Ð½Ð°"); setLoading(false); return; }
    const data = await dbFetch("users", { method:"POST", body: JSON.stringify({ phone, pin, user_id: "tmp", failed_attempts:0 }) });
    if (data?.[0]?.id) {
      const uid = genUserId(data[0].id);
      await dbFetch(`users?id=eq.${data[0].id}`, { method:"PATCH", body: JSON.stringify({ user_id: uid }) });
      saveSession({ ...data[0], user_id: uid });
      onLogin({ ...data[0], user_id: uid });
    } else { setErr("Ð‘Ò¯Ñ€Ñ‚Ð³ÑÐ» Ð°Ð¼Ð¶Ð¸Ð»Ñ‚Ð³Ò¯Ð¹"); }
    setLoading(false);
  };

  const login = async () => {
    if (!phone || !pin) { setErr("Ð”ÑƒÐ³Ð°Ð°Ñ€ Ð±Ð¾Ð»Ð¾Ð½ PIN Ð¾Ñ€ÑƒÑƒÐ»Ð½Ð° ÑƒÑƒ"); return; }
    setLoading(true); setErr("");
    const data = await dbFetch(`users?phone=eq.${phone}&select=*`);
    if (!Array.isArray(data) || data.length === 0) { setErr("Ð‘Ò¯Ñ€Ñ‚Ð³ÑÐ»Ð³Ò¯Ð¹ Ð´ÑƒÐ³Ð°Ð°Ñ€"); setLoading(false); return; }
    const user = data[0];
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      setErr("Ð¥ÑÑ‚ Ð¾Ð»Ð¾Ð½ ÑƒÐ´Ð°Ð° Ð±ÑƒÑ€ÑƒÑƒ Ð¾Ñ€ÑƒÑƒÐ»ÑÐ°Ð½. Ð¢Ò¯Ñ€ Ñ…Ò¯Ð»ÑÑÐ½Ñ Ò¯Ò¯"); setLoading(false); return;
    }
    if (user.pin !== pin) {
      const attempts = (user.failed_attempts || 0) + 1;
      const locked = attempts >= 3 ? { locked_until: new Date(Date.now() + 15 * 60 * 1000).toISOString() } : {};
      await dbFetch(`users?id=eq.${user.id}`, { method:"PATCH", body: JSON.stringify({ failed_attempts: attempts, ...locked }) });
      setErr(attempts >= 3 ? "3 ÑƒÐ´Ð°Ð° Ð±ÑƒÑ€ÑƒÑƒ Ð¾Ñ€ÑƒÑƒÐ»ÑÐ°Ð½. 15 Ð¼Ð¸Ð½ÑƒÑ‚ Ñ…Ò¯Ð»ÑÑÐ½Ñ Ò¯Ò¯" : `PIN Ð±ÑƒÑ€ÑƒÑƒ Ð±Ð°Ð¹Ð½Ð° (${3 - attempts} Ð¾Ñ€Ð¾Ð»Ð´Ð»Ð¾Ð³Ð¾ Ò¯Ð»Ð´ÑÑÐ½)`);
      setLoading(false); return;
    }
    await dbFetch(`users?id=eq.${user.id}`, { method:"PATCH", body: JSON.stringify({ failed_attempts: 0, locked_until: null }) });
    saveSession(user); onLogin(user);
    setLoading(false);
  };

  const resetPin = async () => {
    if (phone.length < 8) { setErr("Ð£Ñ‚Ð°ÑÐ½Ñ‹ Ð´ÑƒÐ³Ð°Ð°Ñ€ Ð±ÑƒÑ€ÑƒÑƒ Ð±Ð°Ð¹Ð½Ð°"); return; }
    if (pin.length !== 4 || !/^\d+$/.test(pin)) { setErr("Ð¨Ð¸Ð½Ñ PIN 4 Ð¾Ñ€Ð¾Ð½Ñ‚Ð¾Ð¹ Ñ‚Ð¾Ð¾ Ð±Ð°Ð¹Ñ… Ñ‘ÑÑ‚Ð¾Ð¹"); return; }
    if (pin !== pin2) { setErr("PIN Ñ‚Ð°Ð°Ñ€Ð°Ñ…Ð³Ò¯Ð¹ Ð±Ð°Ð¹Ð½Ð°"); return; }
    setLoading(true); setErr("");
    const data = await dbFetch(`users?phone=eq.${phone}&select=id`);
    if (!Array.isArray(data) || data.length === 0) { setErr("Ð‘Ò¯Ñ€Ñ‚Ð³ÑÐ»Ð³Ò¯Ð¹ Ð´ÑƒÐ³Ð°Ð°Ñ€"); setLoading(false); return; }
    await dbFetch(`users?id=eq.${data[0].id}`, { method:"PATCH", body: JSON.stringify({ pin, failed_attempts: 0, locked_until: null }) });
    setErr(""); setMode("login"); alert("PIN Ð°Ð¼Ð¶Ð¸Ð»Ñ‚Ñ‚Ð°Ð¹ ÑÐ¾Ð»Ð¸Ð³Ð´Ð»Ð¾Ð¾!");
    setLoading(false);
  };

  return (
    <div style={{background:C.bg,minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{fontSize:40,marginBottom:8}}>ðŸŽ¬</div>
      <div style={{fontSize:20,fontWeight:800,color:C.txt,marginBottom:4,fontFamily:"Georgia,serif"}}>ÐºÐ¸Ð½Ð¾ Ò¯Ð·ÑÑ… ÑÐ°Ð¼Ð±Ð°Ñ€</div>
      <div style={{fontSize:13,color:C.muted,marginBottom:24}}>{mode==="login"?"ÐÑÐ²Ñ‚Ñ€ÑÑ…":mode==="register"?"Ð‘Ò¯Ñ€Ñ‚Ð³Ò¯Ò¯Ð»ÑÑ…":"PIN ÑÑÑ€Ð³ÑÑÑ…"}</div>
      <div style={{width:"100%",maxWidth:340,background:C.card,borderRadius:16,padding:20,border:`0.5px solid ${C.bd}`}}>
        <div style={{display:"flex",gap:6,marginBottom:16}}>
          {(["login","register","reset"] as const).map(m=>(
            <button key={m} onClick={()=>{setMode(m);setErr("");}} style={{flex:1,padding:"8px 4px",borderRadius:8,border:"none",background:mode===m?C.gold:C.card2,color:mode===m?"#000":C.muted,fontWeight:700,cursor:"pointer",fontSize:11}}>
              {m==="login"?"ÐÑÐ²Ñ‚Ñ€ÑÑ…":m==="register"?"Ð‘Ò¯Ñ€Ñ‚Ð³Ò¯Ò¯Ð»ÑÑ…":"PIN ÑÑÑ€Ð³ÑÑÑ…"}
            </button>
          ))}
        </div>
        <label style={lbl}>Ð£Ñ‚Ð°ÑÐ½Ñ‹ Ð´ÑƒÐ³Ð°Ð°Ñ€</label>
        <input style={inputSt} value={phone} onChange={(e:any)=>setPhone(e.target.value)} placeholder="99001234" type="tel" maxLength={8} />
        <label style={{...lbl,marginTop:10}}>{mode==="reset"?"Ð¨Ð¸Ð½Ñ PIN":"PIN ÐºÐ¾Ð´ (4 Ð¾Ñ€Ð¾Ð½Ñ‚Ð¾Ð¹)"}</label>
        <input style={inputSt} value={pin} onChange={(e:any)=>setPin(e.target.value)} placeholder="****" type="password" maxLength={4} />
        {mode!=="login" && <>
          <label style={{...lbl,marginTop:10}}>PIN Ð´Ð°Ð²Ñ‚Ð°Ñ…</label>
          <input style={inputSt} value={pin2} onChange={(e:any)=>setPin2(e.target.value)} placeholder="****" type="password" maxLength={4} />
        </>}
        {err && <div style={{color:C.red,fontSize:12,marginTop:8}}>{err}</div>}
        <button onClick={mode==="login"?login:mode==="register"?register:resetPin} disabled={loading} style={{...goldBtn,marginTop:14,opacity:loading?0.6:1}}>
          {loading?"Ð¢Ò¯Ñ€ Ñ…Ò¯Ð»ÑÑÐ½Ñ Ò¯Ò¯...":mode==="login"?"ðŸ”“ ÐÑÐ²Ñ‚Ñ€ÑÑ…":mode==="register"?"âœ… Ð‘Ò¯Ñ€Ñ‚Ð³Ò¯Ò¯Ð»ÑÑ…":"ðŸ”„ PIN ÑÐ¾Ð»Ð¸Ñ…"}
        </button>
        <button onClick={onBack} style={{width:"100%",background:"none",border:`0.5px solid ${C.bd}`,color:C.muted,padding:11,borderRadius:10,fontSize:13,cursor:"pointer",marginTop:8}}>Ð‘ÑƒÑ†Ð°Ñ…</button>
      </div>
    </div>
  );
}


function QRCanvas({ text }:{ text:string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const S=140, N=21, sz=Math.floor(S/N);
    ctx.fillStyle="#fff"; ctx.fillRect(0,0,S,S);
    ctx.fillStyle="#000";
    const seed = [...text].reduce((a,ch)=>a+ch.charCodeAt(0),0);
    for (let r=0;r<N;r++) for (let c=0;c<N;c++) {
      const v=(r*N+c+seed)%7;
      const corner=(r<7&&c<7)||(r<7&&c>=N-7)||(r>=N-7&&c<7);
      if (corner||v<3) ctx.fillRect(c*sz,r*sz,sz,sz);
    }
    ([[0,0],[0,N-7],[N-7,0]] as number[][]).forEach(([r,c])=>{
      ctx.strokeStyle="#000"; ctx.lineWidth=sz;
      ctx.strokeRect((c+.5)*sz,(r+.5)*sz,6*sz,6*sz);
      ctx.fillRect((c+2)*sz,(r+2)*sz,3*sz,3*sz);
    });
  },[text]);
  return <canvas ref={ref} width={140} height={140} style={{borderRadius:6,display:"block"}} />;
}

function FilmCard({ film, onClick }:any) {
  return (
    <div onClick={onClick} style={{background:C.card,borderRadius:12,overflow:"hidden",cursor:"pointer",border:`0.5px solid ${C.bd}`,WebkitTapHighlightColor:"transparent"}}>
      <div style={{position:"relative",aspectRatio:"3/4",overflow:"hidden"}}>
        {film.img
          ? <img src={film.img} alt={film.title} style={{width:"100%",height:"100%",objectFit:"cover"}} />
          : <div style={{width:"100%",height:"100%",background:`linear-gradient(160deg,${film.bg||"#1a0820"} 0%,#000 100%)`,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <span style={{fontSize:44}}>ðŸŽ¬</span>
            </div>
        }
        <div style={{position:"absolute",top:8,left:8,background:badgeColor(film.badge),borderRadius:5,padding:"2px 8px",fontSize:11,fontWeight:700,color:"#fff"}}>
          {film.badge}
        </div>
        {!film.free && film.locked && (
          <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.35)",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <span style={{fontSize:28}}>ðŸ”’</span>
          </div>
        )}
      </div>
      <div style={{padding:"7px 8px 10px"}}>
        <div style={{fontSize:12,fontWeight:600,color:C.txt,lineHeight:1.3,marginBottom:5}}>{film.title}</div>

        {!film.free && <div style={{fontSize:10,color:C.muted,textDecoration:"line-through",marginBottom:1}}>{film.op?.toLocaleString()}â‚®</div>}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:4}}>
          <span style={{fontSize:13,fontWeight:700,color:film.free?C.green:C.gold}}>
            {film.free ? "Ò®Ð½ÑÐ³Ò¯Ð¹" : `${film.price?.toLocaleString()}â‚®`}
          </span>
          {film.free
            ? <button style={{background:C.green,border:"none",color:"#fff",borderRadius:16,padding:"5px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>â–¶ Ò®Ð·ÑÑ…</button>
            : <button style={{background:C.gold,border:"none",color:"#000",borderRadius:16,padding:"5px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>ðŸ’³</button>
          }
        </div>
      </div>
    </div>
  );
}

function HomePage({ films, onFilm, onSearch, onAdmin, loading, user, onLogin, onLogout }:any) {
  return (
    <div style={{background:C.bg,minHeight:"100vh",paddingBottom:20}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",background:C.bg,position:"sticky",top:0,zIndex:10,borderBottom:`0.5px solid ${C.bd}`}}>
        <div style={{fontFamily:"Georgia,serif",fontSize:20,fontWeight:800,color:C.txt}}>ÐºÐ¸Ð½Ð¾ Ò¯Ð·ÑÑ… ÑÐ°Ð¼Ð±Ð°Ñ€</div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button onClick={onSearch} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:20}}>ðŸ”</button>
          {user
            ? <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontSize:11,color:C.gold,fontWeight:700}}>{user.user_id}</span>
                <button onClick={onLogout} style={{background:C.card2,border:`0.5px solid ${C.bd}`,color:C.muted,cursor:"pointer",fontSize:11,borderRadius:8,padding:"5px 8px"}}>Ð“Ð°Ñ€Ð°Ñ…</button>
              </div>
            : <button onClick={onLogin} style={{background:C.gold,border:"none",color:"#000",cursor:"pointer",fontSize:12,borderRadius:8,padding:"6px 10px",fontWeight:700}}>ÐÑÐ²Ñ‚Ñ€ÑÑ…</button>
          }
          <button onClick={onAdmin} style={{background:C.card2,border:`0.5px solid ${C.bd}`,color:C.muted,cursor:"pointer",fontSize:12,borderRadius:8,padding:"6px 10px"}}>âš™ï¸</button>
        </div>
      </div>
      <div onClick={onLogin} style={{margin:"12px 12px 8px",background:"linear-gradient(90deg,#0369a1,#0ea5e9)",borderRadius:14,padding:"14px 18px",display:"flex",alignItems:"center",gap:12,cursor:"pointer"}}>
        <span style={{fontSize:26}}>ðŸŽ¬</span>
        <div>
          <div style={{fontSize:14,fontWeight:700,color:"#fff"}}>ÐÑÐ²Ñ‚Ñ€ÑÑ… / Ð‘Ò¯Ñ€Ñ‚Ð³Ò¯Ò¯Ð»ÑÑ…</div>
          <div style={{fontSize:13,color:"#bae6fd"}}>ÐšÐ¸Ð½Ð¾Ð³Ð¾Ð¾ Ò¯Ð·ÑÑ…Ð¸Ð¹Ð½ Ñ‚ÑƒÐ»Ð´ Ð½ÑÐ²Ñ‚ÑÑ€Ð½Ñ Ò¯Ò¯</div>
        </div>
      </div>
      <div style={{padding:"8px 12px 6px"}}>
        <span style={{fontSize:15,fontWeight:700,color:C.txt}}>{films.length} ÐºÐ¸Ð½Ð¾ Ð±Ð°Ð¹Ð½Ð°</span>
      </div>
      {loading
        ? <div style={{textAlign:"center",padding:40,color:C.muted}}>ÐÑ‡Ð°Ð°Ð»Ð»Ð°Ð¶ Ð±Ð°Ð¹Ð½Ð°...</div>
        : <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,padding:"0 10px"}}>
            {films.map((f:any) => <FilmCard key={f.id} film={f} onClick={()=>onFilm(f)} />)}
          </div>
      }
    </div>
  );
}

function BankModal({ film, onClose, onPaid }:any) {
  const [step, setStep] = useState<"banks"|"qr">("banks");
  const [selectedBank, setSelectedBank] = useState<any>(null);
  const selectBank = (bank:any) => {
    setSelectedBank(bank);
    window.location.href = `${bank.deep}${film.price}&memo=mgldrama_${film.id}`;
    setTimeout(() => setStep("qr"), 1500);
  };
  if (step === "qr") {
    return (
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",display:"flex",alignItems:"flex-end",zIndex:200}}>
        <div style={{background:C.card,borderRadius:"18px 18px 0 0",padding:"20px 20px 40px",width:"100%",border:`0.5px solid ${C.bd}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <button onClick={()=>setStep("banks")} style={{background:"none",border:"none",color:C.muted,fontSize:20,cursor:"pointer"}}>â†</button>
              <span style={{fontSize:15,fontWeight:700,color:C.txt}}>{selectedBank?.name}</span>
            </div>
            <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,fontSize:24,cursor:"pointer"}}>âœ•</button>
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:10,marginBottom:16}}>
            <div style={{fontSize:26,fontWeight:800,color:C.gold}}>{film.price?.toLocaleString()}â‚®</div>
            <div style={{background:"#fff",borderRadius:8,padding:6}}>
              <QRCanvas text={`qpay:mgldrama:${film.id}:${film.price}:${selectedBank?.id}`} />
            </div>
            <div style={{fontSize:12,color:C.muted,textAlign:"center"}}>{selectedBank?.name}-Ð½Ñ‹ QPay Ð°Ð¿Ð¿Ð°Ð°Ñ€ ÑÐºÐ°Ð½ Ñ…Ð¸Ð¹Ð½Ñ Ò¯Ò¯</div>
          </div>
          <button onClick={onPaid} style={{width:"100%",background:"#166534",border:"0.5px solid #16a34a",color:"#4ade80",padding:14,borderRadius:10,fontSize:15,fontWeight:700,cursor:"pointer",marginBottom:10}}>
            âœ… Ð¢Ó©Ð»Ð±Ó©Ñ€ Ñ…Ð¸Ð¹ÑÑÐ½ â€” ÐšÐ¸Ð½Ð¾ Ò¯Ð·ÑÑ…
          </button>
          <button onClick={onClose} style={{width:"100%",background:"none",border:`0.5px solid ${C.bd}`,color:C.muted,padding:12,borderRadius:10,fontSize:14,cursor:"pointer"}}>Ð‘ÑƒÑ†Ð°Ñ…</button>
        </div>
      </div>
    );
  }
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",display:"flex",alignItems:"flex-end",zIndex:200}}>
      <div style={{background:C.card,borderRadius:"18px 18px 0 0",padding:"20px 20px 36px",width:"100%",border:`0.5px solid ${C.bd}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <div>
            <div style={{fontSize:16,fontWeight:700,color:C.txt}}>{film.title}</div>
            <div style={{fontSize:22,fontWeight:800,color:C.gold,marginTop:2}}>{film.price?.toLocaleString()}â‚®</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,fontSize:26,cursor:"pointer"}}>âœ•</button>
        </div>
        <p style={{fontSize:13,color:C.muted,marginBottom:14}}>Ð‘Ð°Ð½ÐºÐ°Ð° ÑÐ¾Ð½Ð³Ð¾Ð½Ð¾ ÑƒÑƒ</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,maxHeight:"50vh",overflowY:"auto"}}>
          {BANKS.map(bank => (
            <button key={bank.id} onClick={()=>selectBank(bank)} style={{background:C.card2,border:`0.5px solid ${C.bd}`,borderRadius:10,padding:"14px 10px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
              <div style={{width:40,height:40,borderRadius:10,background:bank.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{bank.icon}</div>
              <span style={{fontSize:12,fontWeight:600,color:C.txt,textAlign:"center"}}>{bank.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function getVideoEmbed(url: string): { type: "iframe"|"video"|"youtube", src: string } {
  if (!url) return { type:"iframe", src:"" };
  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return { type:"youtube", src:`https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&rel=0&modestbranding=1&playsinline=1` };
  // MP4 / direct video
  if (url.match(/\.(mp4|webm|ogg|mov)(\?|$)/i)) return { type:"video", src: url };
  // Google Drive
  const gdMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (gdMatch) return { type:"iframe", src:`https://drive.google.com/file/d/${gdMatch[1]}/preview` };
  // Default iframe
  return { type:"iframe", src: url };
}

function VideoPage({ film, onBack }:any) {
  const [showControls, setShowControls] = useState(true);
  const { type, src } = getVideoEmbed(film.url || "");

  useEffect(() => {
    const t = setTimeout(() => setShowControls(false), 4000);
    // Push state to prevent browser back
    window.history.pushState({ video: true }, "");
    const handlePop = () => { onBack(); };
    window.addEventListener("popstate", handlePop);
    return () => { clearTimeout(t); window.removeEventListener("popstate", handlePop); };
  }, []);

  return (
    <div
      onClick={() => setShowControls(v => !v)}
      style={{background:"#000", position:"fixed", inset:0, zIndex:50}}
    >
      {/* Fullscreen video */}
      {src ? (
        type === "video"
          ? <video
              src={src}
              autoPlay
              controls
              playsInline
              style={{position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"contain"}}
            />
          : <iframe
              src={src}
              style={{position:"absolute", inset:0, width:"100%", height:"100%", border:"none"}}
              allowFullScreen
              allow="autoplay; fullscreen; picture-in-picture"
            />
      ) : (
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",color:C.muted,fontSize:14}}>
          Ð’Ð¸Ð´ÐµÐ¾ Ñ…Ð¾Ð»Ð±Ð¾Ð¾Ñ Ð±Ð°Ð¹Ñ…Ð³Ò¯Ð¹ Ð±Ð°Ð¹Ð½Ð°
        </div>
      )}

      {/* Back button */}
      <div style={{
        position:"absolute", top:0, left:0, right:0, zIndex:10,
        background:"linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)",
        padding:"16px",
        transition:"opacity 0.3s",
        opacity: showControls ? 1 : 0,
        pointerEvents: showControls ? "auto" : "none",
      }}>
        <button
          onClick={(e) => { e.stopPropagation(); onBack(); }}
          style={{background:"rgba(0,0,0,0.5)", border:"none", color:"#fff", fontSize:22, cursor:"pointer", borderRadius:50, width:44, height:44, display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(10px)"}}
        >â†</button>
      </div>
    </div>
  );
}

function SearchPage({ films, onFilm, onBack }:any) {
  const [q,setQ]=useState("");
  const res = q ? films.filter((f:any)=>f.title.toLowerCase().includes(q.toLowerCase())) : films;
  return (
    <div style={{background:C.bg,minHeight:"100vh"}}>
      <div style={{background:C.card,padding:"12px 14px",display:"flex",alignItems:"center",gap:10,borderBottom:`0.5px solid ${C.bd}`}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:C.muted,fontSize:22,cursor:"pointer"}}>â†</button>
        <input autoFocus value={q} onChange={(e:any)=>setQ(e.target.value)} placeholder="ÐšÐ¸Ð½Ð¾ Ñ…Ð°Ð¹Ñ…..." style={{...inputSt,flex:1}} />
      </div>
      <div style={{padding:"12px 14px"}}>
        {q && res.length===0 && <p style={{color:C.muted,textAlign:"center",marginTop:40}}>ÐžÐ»Ð´ÑÐ¾Ð½Ð³Ò¯Ð¹</p>}
        {res.map((f:any)=>(
          <div key={f.id} onClick={()=>onFilm(f)} style={{display:"flex",gap:12,alignItems:"center",padding:"10px 0",borderBottom:`0.5px solid ${C.bd}`,cursor:"pointer"}}>
            <div style={{width:44,height:60,borderRadius:6,background:f.bg||"#1a0820",flexShrink:0,overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center"}}>
              {f.img ? <img src={f.img} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} /> : <span style={{fontSize:20}}>ðŸŽ¬</span>}
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:600,color:C.txt}}>{f.title}</div>
              <div style={{fontSize:12,color:f.free?C.green:C.gold,marginTop:3}}>{f.free?"Ò®Ð½ÑÐ³Ò¯Ð¹":`${f.price?.toLocaleString()}â‚®`}</div>
            </div>
            {!f.free && f.locked && <span style={{fontSize:16}}>ðŸ”’</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminLogin({ onEnter, onBack }:any) {
  const [key,setKey]=useState(""); const [err,setErr]=useState(false);
  const go=()=>{ if(key===ADMIN_KEY){onEnter();}else{setErr(true);} };
  return (
    <div style={{background:C.bg,minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{fontSize:40,marginBottom:12}}>ðŸ”</div>
      <div style={{fontSize:18,fontWeight:700,color:C.txt,marginBottom:20}}>ÐÐ´Ð¼Ð¸Ð½ Ð½ÑÐ²Ñ‚Ñ€ÑÑ…</div>
      <div style={{width:"100%",maxWidth:320}}>
        <input type="password" value={key} onChange={(e:any)=>setKey(e.target.value)} placeholder="ÐÑƒÑƒÑ† ÐºÐ¾Ð´" style={inputSt} onKeyDown={(e:any)=>e.key==="Enter"&&go()} />
        {err && <p style={{color:"#f05555",fontSize:12,marginTop:6}}>ÐÑƒÑƒÑ† ÐºÐ¾Ð´ Ð±ÑƒÑ€ÑƒÑƒ Ð±Ð°Ð¹Ð½Ð°</p>}
        <button onClick={go} style={{...goldBtn,marginTop:12}}>ÐÑÐ²Ñ‚Ñ€ÑÑ…</button>
        <button onClick={onBack} style={{width:"100%",background:"none",border:`0.5px solid ${C.bd}`,color:C.muted,padding:12,borderRadius:10,fontSize:14,cursor:"pointer",marginTop:8}}>Ð‘ÑƒÑ†Ð°Ñ…</button>
      </div>
    </div>
  );
}

function AdminPage({ films, onBack, onRefresh }:any) {
  const [tab, setTab] = useState<"list"|"add">("list");
  const [editId, setEditId] = useState<number|null>(null);
  const [saving, setSaving] = useState(false);
  const [imgVal, setImgVal] = useState("");
  const [urlVal, setUrlVal] = useState("");
  const empty = {title:"",views:0,op:6000,price:4000,badge:"Ð¥ÑÐ»Ñ‚ÑÐ¹",free:false,locked:true,url:"",img:"",bg:"#1a0820"};
  const [form,setForm]=useState<any>(empty);
  const set=(k:string)=>(e:any)=>setForm((f:any)=>({...f,[k]:e.target.value}));
  const setChk=(k:string)=>(e:any)=>setForm((f:any)=>({...f,[k]:e.target.checked}));

  const save = async () => {
    if (!form.title.trim()){alert("Ð“Ð°Ñ€Ñ‡Ð¸Ð³ Ð¾Ñ€ÑƒÑƒÐ»Ð½Ð° ÑƒÑƒ");return;}
    setSaving(true);
    await dbFetch("films", {
      method:"POST",
      body: JSON.stringify({...form, views:parseInt(form.views)||0, op:parseInt(form.op)||6000, price:parseInt(form.price)||0})
    });
    setSaving(false);
    setForm(empty);
    setTab("list");
    onRefresh();
  };

  const deletFilm = async (id:number) => {
    if (!window.confirm("Ð£ÑÑ‚Ð³Ð°Ñ… ÑƒÑƒ?")) return;
    await dbFetch(`films?id=eq.${id}`, {method:"DELETE"});
    onRefresh();
  };

  const toggleLock = async (film:any) => {
    await dbFetch(`films?id=eq.${film.id}`, {
      method:"PATCH",
      body: JSON.stringify({locked: !film.locked})
    });
    onRefresh();
  };

  const updateImg = async (id:number, img:string) => {
    await dbFetch(`films?id=eq.${id}`, {method:"PATCH", body: JSON.stringify({img})});
    setEditId(null);
    onRefresh();
  };

  const updateUrl = async (id:number, url:string) => {
    await dbFetch(`films?id=eq.${id}`, {method:"PATCH", body: JSON.stringify({url})});
    setEditId(null);
    onRefresh();
  };

  return (
    <div style={{background:C.bg,minHeight:"100vh",paddingBottom:30}}>
      <div style={{background:C.card,padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:`0.5px solid ${C.bd}`,position:"sticky",top:0,zIndex:10}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={onBack} style={{background:"none",border:"none",color:C.muted,fontSize:22,cursor:"pointer"}}>â†</button>
          <span style={{fontSize:15,fontWeight:700,color:C.txt}}>ÐšÐ¸Ð½Ð¾ ÑƒÐ´Ð¸Ñ€Ð´Ð°Ñ…</span>
        </div>
        <span style={{fontSize:12,color:C.muted}}>{films.length} ÐºÐ¸Ð½Ð¾</span>
      </div>
      <div style={{display:"flex",padding:"10px 14px",gap:8}}>
        <button onClick={()=>setTab("list")} style={{flex:1,padding:"10px",borderRadius:8,border:"none",background:tab==="list"?C.gold:C.card2,color:tab==="list"?"#000":C.muted,fontWeight:700,cursor:"pointer",fontSize:13}}>ðŸ“‹ Ð–Ð°Ð³ÑÐ°Ð°Ð»Ñ‚</button>
        <button onClick={()=>setTab("add")} style={{flex:1,padding:"10px",borderRadius:8,border:"none",background:tab==="add"?C.gold:C.card2,color:tab==="add"?"#000":C.muted,fontWeight:700,cursor:"pointer",fontSize:13}}>âž• ÐÑÐ¼ÑÑ…</button>
      </div>

      {tab==="add" && (
        <div style={{padding:"0 14px"}}>
          <div style={{background:C.card,border:`0.5px solid ${C.bd}`,borderRadius:12,padding:16}}>
            <label style={lbl}>Ð“Ð°Ñ€Ñ‡Ð¸Ð³ *</label>
            <input style={inputSt} value={form.title} onChange={set("title")} placeholder="ÐšÐ¸Ð½Ð¾ Ð½ÑÑ€" />
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:10}}>
              <div><label style={lbl}>Ò®Ð·ÑÑÐ½ Ñ‚Ð¾Ð¾</label><input style={inputSt} value={form.views} onChange={set("views")} type="number" /></div>
              <div><label style={lbl}>Badge</label>
                <select style={inputSt} value={form.badge} onChange={set("badge")}><option>Ð¥ÑÐ»Ñ‚ÑÐ¹</option><option>Ð¥Ð°Ð´Ð¼Ð°Ð»</option></select>
              </div>
              <div><label style={lbl}>Ð¥ÑƒÑƒÑ‡Ð¸Ð½ Ò¯Ð½Ñ â‚®</label><input style={inputSt} value={form.op} onChange={set("op")} type="number" /></div>
              <div><label style={lbl}>Ð—Ð°Ñ€Ð°Ñ… Ò¯Ð½Ñ â‚®</label><input style={inputSt} value={form.price} onChange={set("price")} type="number" /></div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8,marginTop:12,padding:"10px",background:C.card2,borderRadius:8}}>
              <input type="checkbox" id="cb-free" checked={form.free} onChange={setChk("free")} style={{width:18,height:18}} />
              <label htmlFor="cb-free" style={{fontSize:14,color:C.txt,cursor:"pointer"}}>ðŸ†“ Ò®Ð½ÑÐ³Ò¯Ð¹ ÐºÐ¸Ð½Ð¾</label>
            </div>
            <label style={{...lbl,marginTop:12}}>Ð’Ð¸Ð´ÐµÐ¾ URL (YouTube / MP4 / Google Drive)</label>
            <input style={inputSt} value={form.url} onChange={set("url")} placeholder="https://youtu.be/... ÑÑÐ²ÑÐ» .mp4 Ñ…Ð¾Ð»Ð±Ð¾Ð¾Ñ" />
            <label style={{...lbl,marginTop:10}}>Ð—ÑƒÑ€Ð³Ð¸Ð¹Ð½ URL ÑÑÐ²ÑÐ» Ñ„Ð°Ð¹Ð»</label>
            <input style={inputSt} value={form.img} onChange={set("img")} placeholder="https://... ÑÑÐ²ÑÐ» Ð´Ð¾Ð¾Ñ€ Ñ„Ð°Ð¹Ð» ÑÐ¾Ð½Ð³Ð¾" />
            <input type="file" accept="image/*" onChange={(e:any)=>{
              const file = e.target.files?.[0]; if(!file) return;
              const reader = new FileReader();
              reader.onload = (ev:any) => setForm((f:any)=>({...f,img:ev.target.result}));
              reader.readAsDataURL(file);
            }} style={{marginTop:6,fontSize:12,color:C.muted,width:"100%"}} />
            <button onClick={save} disabled={saving} style={{...goldBtn,marginTop:16,opacity:saving?0.6:1}}>
              {saving ? "Ð¥Ð°Ð´Ð³Ð°Ð»Ð¶ Ð±Ð°Ð¹Ð½Ð°..." : "âœ… Ð¥Ð°Ð´Ð³Ð°Ð»Ð°Ñ…"}
            </button>
          </div>
        </div>
      )}

      {tab==="list" && (
        <div style={{padding:"0 14px"}}>
          {films.map((f:any) => (
            <div key={f.id} style={{background:C.card,border:`0.5px solid ${C.bd}`,borderRadius:12,padding:12,marginBottom:10}}>
              <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:10}}>
                <div style={{width:44,height:60,borderRadius:6,background:f.bg||"#1a0820",flexShrink:0,overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {f.img ? <img src={f.img} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} /> : <span style={{fontSize:20}}>ðŸŽ¬</span>}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:600,color:C.txt,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.title}</div>
                  <div style={{fontSize:11,color:C.muted,marginTop:2}}>{f.badge} Â· {f.free?"Ò®Ð½ÑÐ³Ò¯Ð¹":`${f.price?.toLocaleString()}â‚®`} Â· {f.views} Ò¯Ð·ÑÑÐ½</div>
                  <div style={{fontSize:11,marginTop:2,color:f.locked?C.red:C.green}}>{f.locked?"ðŸ”’ Ð¥Ð°Ð°Ð»Ñ‚Ñ‚Ð°Ð¹":"ðŸ”“ ÐÑÑÐ»Ñ‚Ñ‚ÑÐ¹"}</div>
                </div>
              </div>
              <div style={{display:"flex",gap:6}}>
                <button onClick={()=>toggleLock(f)} style={{flex:1,padding:"8px 4px",borderRadius:8,border:`0.5px solid ${C.bd}`,background:f.locked?"#166534":"#7f1d1d",color:f.locked?"#4ade80":"#f87171",fontSize:12,fontWeight:600,cursor:"pointer"}}>
                  {f.locked ? "ðŸ”“ ÐÑÑÑ…" : "ðŸ”’ Ð¥Ð°Ð°Ñ…"}
                </button>
                <button onClick={()=>setEditId(editId===f.id?null:f.id)} style={{flex:1,padding:"8px 4px",borderRadius:8,border:`0.5px solid ${C.bd}`,background:C.card2,color:C.muted,fontSize:12,cursor:"pointer"}}>âœï¸ Ð—Ð°ÑÐ°Ñ…</button>
                <button onClick={()=>deletFilm(f.id)} style={{padding:"8px 12px",borderRadius:8,border:`0.5px solid #3a1a1a`,background:"#1a0a0a",color:"#f05555",fontSize:12,cursor:"pointer"}}>ðŸ—‘ï¸</button>
              </div>
              {editId===f.id && (
                <div style={{marginTop:10,borderTop:`0.5px solid ${C.bd}`,paddingTop:10}}>
                  <label style={lbl}>Ð—ÑƒÑ€Ð³Ð¸Ð¹Ð½ URL ÑÑÐ²ÑÐ» Ñ„Ð°Ð¹Ð»</label>
                  <div style={{display:"flex",gap:6}}>
                    <input defaultValue={f.img} onChange={(e:any)=>setImgVal(e.target.value)} style={{...inputSt,flex:1}} placeholder="https://..." />
                    <button onClick={()=>updateImg(f.id,imgVal)} style={{background:C.gold,border:"none",borderRadius:8,padding:"0 12px",fontWeight:700,cursor:"pointer",color:"#000",fontSize:12}}>OK</button>
                  </div>
                  <input type="file" accept="image/*" onChange={(e:any)=>{
                    const file = e.target.files?.[0]; if(!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev:any) => { setImgVal(ev.target.result as string); updateImg(f.id, ev.target.result as string); };
                    reader.readAsDataURL(file);
                  }} style={{marginTop:4,fontSize:12,color:C.muted,width:"100%"}} />
                  <label style={{...lbl,marginTop:8}}>Ð’Ð¸Ð´ÐµÐ¾ URL (YouTube / MP4 / Drive)</label>
                  <div style={{display:"flex",gap:6}}>
                    <input defaultValue={f.url} onChange={(e:any)=>setUrlVal(e.target.value)} style={{...inputSt,flex:1}} placeholder="https://youtu.be/..." />
                    <button onClick={()=>updateUrl(f.id,urlVal)} style={{background:C.gold,border:"none",borderRadius:8,padding:"0 12px",fontWeight:700,cursor:"pointer",color:"#000",fontSize:12}}>OK</button>
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

  useEffect(() => {
    const s = loadSession();
    if (s) setUser(s);
  }, []);

  const loadFilms = async () => {
    setLoading(true);
    const data = await dbFetch("films?order=created_at.desc&select=*");
    setFilms(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { loadFilms(); }, []);

  const handleFilm = (f:any) => {
    const unlocked = unlockedIds.includes(f.id);
    if (f.free || !f.locked || unlocked) { setCurFilm({...f,locked:false}); setPage("video"); }
    else setPayFilm(f);
  };

  const handlePaid = () => {
    setUnlockedIds(ids => [...ids, payFilm.id]);
    setCurFilm({...payFilm, locked:false});
    setPayFilm(null);
    setPage("video");
  };

  const handleLogin = (u:any) => { setUser(u); setPage("home"); };
  const handleLogout = () => { clearSession(); setUser(null); };

  const filmsWithUnlock = films.map(f => unlockedIds.includes(f.id) ? {...f, locked:false} : f);

  return (
    <div style={{maxWidth:430,margin:"0 auto",fontFamily:"system-ui,sans-serif",background:C.bg}}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}html,body{background:#0d0d14}input,select,button{font-family:inherit}input:focus,select:focus{outline:none;border-color:#e8a020!important}::-webkit-scrollbar{width:0}`}</style>
      {page==="home"       && <HomePage films={filmsWithUnlock} onFilm={handleFilm} onSearch={()=>setPage("search")} onAdmin={()=>setPage("adminlogin")} loading={loading} user={user} onLogin={()=>setPage("login")} onLogout={handleLogout} />}
      {page==="login"      && <LoginPage onLogin={handleLogin} onBack={()=>setPage("home")} />}
      {page==="video"      && curFilm && <VideoPage film={curFilm} onBack={()=>setPage("home")} />}
      {page==="search"     && <SearchPage films={filmsWithUnlock} onFilm={handleFilm} onBack={()=>setPage("home")} />}
      {page==="adminlogin" && <AdminLogin onEnter={()=>{setAdminAuth(true);setPage("admin");}} onBack={()=>setPage("home")} />}
      {page==="admin"      && adminAuth && <AdminPage films={films} onBack={()=>setPage("home")} onRefresh={loadFilms} />}
      {payFilm && <BankModal film={payFilm} onClose={()=>setPayFilm(null)} onPaid={handlePaid} />}
    </div>
  );
}


