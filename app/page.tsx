"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

import { paymentExpiry, safeUrl, planLabel, plans as PLAN_PRICES } from "@/lib/domain";

import { dbFetch, dbAll, requestJson, RequestError } from "@/lib/client";
import PosterUpload from "@/app/components/PosterUpload";
import TrailerEditor, { type TrailerEditorHandle } from "@/app/components/TrailerEditor";
import ReadinessCheck from "@/app/components/ReadinessCheck";
import CatalogBrowser from "@/app/components/CatalogBrowser";
import ConnectionStatus from "@/app/components/ConnectionStatus";
import AppInstallButton from "@/app/components/AppInstallButton";
import PushNotificationSetup from "@/app/components/PushNotificationSetup";
import AdminEntryLogo from "@/app/components/AdminEntryLogo";
import AppearanceEditor from "@/app/components/AppearanceEditor";
import useSiteAppearance from "@/app/components/useSiteAppearance";
import {appearanceStyle} from "@/lib/appearance";
import CopyFilmLink from "@/app/components/CopyFilmLink";
import FilmLanding from "@/app/components/FilmLanding";
import TrailerPosterFrame from "@/app/components/TrailerPosterFrame";
import { AdminChatInbox, ChatPanel, ChatBadge, useChatUnread } from "@/app/components/SupportChat";
import { INITIAL_CATALOG, type CatalogState } from "@/lib/catalog";
import { filmPlans, getVideoEmbed, type FilmDetails } from "@/lib/film-details";
import { filmNavigationUrl, prepareFilmHistory, readFilmDestination, type FilmDestination } from "@/lib/film-link";

// ══════════════════════════════════════════════
// ДАНСНЫ МЭДЭЭЛЭЛ
// ══════════════════════════════════════════════
const DEFAULT_BANK_ACCOUNT = {
  bank: "Хаан банк",
  number: "5251258979",
  name: "Т.Жаргалбаяр",
  iban: "MN03000500",
};
const DEFAULT_bankAccount = DEFAULT_BANK_ACCOUNT;

function analyticsSource(): "facebook" | "direct" | "other" {
  if (typeof window === "undefined") return "direct";
  const ref = document.referrer.toLowerCase();
  const params = new URLSearchParams(window.location.search);
  if (params.has("fbclid") || ref.includes("facebook.com") || ref.includes("messenger.com")) return "facebook";
  return ref ? "other" : "direct";
}

function trackSiteEvent(event:"visit"|"film_open"|"watch_click"|"payment_open"|"play_start", filmId?:number) {
  if (typeof window === "undefined") return;
  void requestJson("/api/analytics",{
    method:"POST",
    body:JSON.stringify({event,film_id:filmId||null,source:analyticsSource()}),
  },true).catch(()=>{});
}

function genUserId(id: number) { return "#" + String(id).padStart(6, "0"); }
function genRef(): string {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return String(100000 + values[0] % 900000);
}

// badge дотор cat encode/decode хийх
function encodeBadgeCat(badge: string, cat: string): string {
  const b = badge.split("|")[0];
  return cat && cat !== "Эротик" ? `${b}|${cat}` : b;
}
function decodeBadge(badge: string): string { return (badge || "").split("|")[0] || "Хэлтэй"; }
function decodeCat(badge: string): string { return (badge || "").split("|")[1] || "Эротик"; }

const C = {
  bg: "var(--background)", card: "var(--surface)", card2: "var(--surface-raised, #1a2431)", bd: "var(--border)",
  txt: "var(--foreground)", muted: "var(--muted)",
  red: "#e8281e", gold: "var(--accent)", green: "#16a34a", blue: "#2563eb", amber: "#ca8a04",
};

const badgeColor = (b: string) => b === "Хадмал" ? C.amber : C.blue;

const inputSt: any = {
  width: "100%", background: C.bg, border: `1px solid ${C.bd}`,
  borderRadius: 10, padding: "13px 15px", color: C.txt, fontSize: 16,
  outline: "none", boxSizing: "border-box", fontFamily: "inherit",
};
const goldBtn: any = {
  width: "100%", background: C.gold, border: "none", color: "#000",
  padding: 13, borderRadius: 10, fontSize: 15, fontWeight: 700,
  cursor: "pointer", fontFamily: "inherit",
};
const lbl: any = { fontSize: 14, color: C.muted, display: "block", marginBottom: 5 };

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
    const match = text.match(/\b(\d{6})\b/);
    if (match) return match[1];
    return null;
  };

  const verify = () => {
    const ref = extractRef(smsText);
    if (!ref) {
      setErr("Мэссэжнээс гүйлгээний утга олдсонгүй. 6 оронтой гүйлгээний кодыг шалгана уу.");
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
            Орлого 5,000₮ Гүйлгээний утга: <span style={{ color: C.gold }}>476400</span> Данс: XXXX1234 ...
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
function BankModal({ film, onClose, onPaid, user, inline = false }: any) {
  const isWalletTopup=film.plan==="wallet_topup";
  const isSimpleMovieTopup=isWalletTopup&&!film.returnPlan;
  const [selectedTopup,setSelectedTopup]=useState<number>(()=>Number.isSafeInteger(Number(film.topupAmount))&&Number(film.topupAmount)>=5000?Number(film.topupAmount):5000);
  const packageTopupNeed=film.returnPlan?Math.max(5000,Number(film.returnPrice||PLAN_PRICES[film.returnPlan]||0)-Number(film.walletBefore||0)):5000;
  const topupChoices=Array.from(new Set([5000,10000,20000,selectedTopup])).filter(amount=>!film.returnPlan||amount>=packageTopupNeed).sort((a,b)=>a-b);
  const [showTransferDetails,setShowTransferDetails]=useState(!isWalletTopup || isSimpleMovieTopup);
  const transferPanelRef=useRef<HTMLDivElement>(null);
  const [bankAccount,setBankAccount]=useState(DEFAULT_BANK_ACCOUNT);
  useEffect(()=>{
    let alive=true;
    requestJson("/api/settings",{},true).then(data=>{
      if(!alive)return;
      const bank=String(data?.bankName||DEFAULT_bankAccount.bank).trim();
      const number=String(data?.bankAccount||DEFAULT_bankAccount.number).trim();
      const name=String(data?.accountName||DEFAULT_bankAccount.name).trim();
      const iban=String(data?.bankIban||"").toUpperCase().replace(/\s+/g,"");
      setBankAccount({bank:bank||DEFAULT_bankAccount.bank,number:number||DEFAULT_bankAccount.number,name:name||DEFAULT_bankAccount.name,iban:/^MN\d{1,8}$/.test(iban)?iban:""});
    }).catch(()=>{});
    return()=>{alive=false;};
  },[]);
  const [paymentError, setPaymentError] = useState("");
  const [orderReady,setOrderReady]=useState(false);
  const [orderAmount,setOrderAmount]=useState<number|null>(null);
  const [refCode,setRefCode] = useState(() => genRef());
  const refRetries=useRef(0);
  const [copied, setCopied] = useState<string | null>(null);
  const [autoStatus, setAutoStatus] = useState<"waiting" | "checking" | "paid" | "timeout">("waiting");
  const [showSms, setShowSms] = useState(false);
  const [manualChecking, setManualChecking] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completed = useRef(false);
  const finishing = useRef(false);
  const confirmationSeen = useRef(false);
  const active = useRef(true);
  const paidCallback = useRef(onPaid);
  useEffect(() => { paidCallback.current = onPaid; }, [onPaid]);
  const timeoutRef = useRef<any>(null);

  const finishPayment = async (stillActive = () => active.current) => {
    if (completed.current || finishing.current || !stillActive()) return;
    finishing.current = true;
    confirmationSeen.current = true;
    setPaymentError("");
    setAutoStatus("paid");
    try {
      await paidCallback.current(stillActive);
      if (stillActive()) completed.current = true;
    } finally {
      finishing.current = false;
    }
  };

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

  useEffect(() => {
    let cancelled=false; active.current=true;
    let stopAt=0;
    let checking=false;
    let ready=false;
    const check=async()=>{
      if(cancelled||completed.current||checking||!ready)return;
      if(intervalRef.current)clearTimeout(intervalRef.current);
      if(document.hidden){intervalRef.current=setTimeout(check,4000);return;}
      checking=true;
      try {
        if(!confirmationSeen.current)setAutoStatus("checking");
        const rows=await requestJson(`/api/db?path=${encodeURIComponent(`pending_payments?ref_code=eq.${refCode}&select=id,status`)}`,{},true);
        if(cancelled)return;
        if(rows?.[0]?.status==='confirmed'){await finishPayment(()=>!cancelled);return;}
        if(!rows?.length || rows[0].status!=='pending'){
          const status=String(rows?.[0]?.status||"");
          ready=false;setOrderReady(false);setAutoStatus("timeout");
          setPaymentError(status==="expired"
            ?"Энэ төлбөрийн кодын 24 цагийн хугацаа дууссан. Шинэ код үүсгээд төлбөр хийнэ үү."
            :"Захиалга цуцлагдсан эсвэл олдсонгүй. Төлбөр шилжүүлэхгүй, админтай холбогдоно уу.");
          return;
        }
        if(Date.now()>stopAt){ready=false;setOrderReady(false);setAutoStatus("timeout");return;}
        setAutoStatus("waiting");setPaymentError("");
      }catch(err){if(!cancelled){setPaymentError(err instanceof Error?err.message:"Төлбөр шалгахад алдаа гарлаа.");setAutoStatus(confirmationSeen.current?"paid":"waiting");}}
      finally {
        checking=false;
        if(!cancelled&&!completed.current&&ready)intervalRef.current=setTimeout(check,4000);
      }
    };
    const start=async()=>{
      try{
        const rows=await dbFetch("pending_payments",{method:"POST",body:JSON.stringify({ref_code:refCode,film_id:film.id||null,plan:film.plan||(film.monthly?"monthly":"single"),...(film.plan==="wallet_topup"?{amount:Number(film.topupAmount||film.price||5000)}:{})})},true);
        if(!Array.isArray(rows)||!rows.length)throw new Error("Захиалга үүссэнгүй.");
        const savedRef=String(rows[0].ref_code||"");
        if(savedRef && savedRef!==refCode){if(!cancelled)setRefCode(savedRef);return;}
        const amount=Number(rows[0].amount),created=Date.parse(rows[0].created_at);
        if(!Number.isSafeInteger(amount)||amount<=0||!Number.isFinite(created))throw new Error("Захиалгын дүн эсвэл хугацаа буруу байна.");
        stopAt=created+24*60*60*1000;
        if(!cancelled){ready=true;setOrderAmount(amount);setOrderReady(true);void check();}
      }catch(err){if(!cancelled){
        if(err instanceof RequestError&&err.code==='REF_CONFLICT'&&refRetries.current<5){refRetries.current++;setRefCode(genRef());return;}
        setPaymentError(err instanceof Error?err.message:"Захиалга үүссэнгүй.");
      }}
    };
    const resume=()=>{if(!document.hidden)void check();};
    window.addEventListener("focus",resume);window.addEventListener("online",resume);document.addEventListener("visibilitychange",resume);
    void start();
    return()=>{window.removeEventListener("focus",resume);window.removeEventListener("online",resume);document.removeEventListener("visibilitychange",resume);cancelled=true;active.current=false;if(intervalRef.current)clearTimeout(intervalRef.current);if(timeoutRef.current)clearTimeout(timeoutRef.current);};
  },[film.id,film.plan,film.monthly,refCode]);

  const revealTransferDetails=()=>{
    setShowTransferDetails(true);
    window.requestAnimationFrame(()=>{
      window.requestAnimationFrame(()=>{
        const panel=transferPanelRef.current;
        if(!panel)return;
        const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
        panel.scrollIntoView({behavior:reduced?"auto":"smooth",block:"center"});
      });
    });
  };

  const handleSmsFound=async(foundRef:string)=>{
    setShowSms(false);setPaymentError("");
    if(foundRef!==refCode){setPaymentError("Энэ захиалгын гүйлгээний кодыг оруулна уу.");return;}
    if(completed.current||manualChecking)return;
    setManualChecking(true);
    try {
      const rows=await dbFetch(`pending_payments?ref_code=eq.${refCode}&status=eq.confirmed&select=id`);
      if(!active.current)return;
      if(rows?.length)await finishPayment();
      else setPaymentError("Төлбөр хараахан баталгаажаагүй. Админ эсвэл банкны баталгааг хүлээнэ үү.");
    }catch(err){if(active.current)setPaymentError(err instanceof Error?err.message:"Алдаа гарлаа.");}
    finally{if(active.current)setManualChecking(false);}
  };

  if (autoStatus === "paid") {
    return (
      <div className={inline ? "checkout-inline checkout-complete" : ""} style={inline ? undefined : { position: "fixed", inset: 0, background: "rgba(0,0,0,0.97)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 72, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.green }}>Төлбөр баталгаажлаа!</div>
          <div style={{ fontSize: 14, color: C.muted, marginTop: 8 }}>Үзэх эрх нээгдэж байна...</div>
          {paymentError && <><p role="alert">{paymentError}</p><p>Холболт сэргэхэд дахин оролдоно. Дахин мөнгө шилжүүлэх шаардлагагүй.</p></>}
          <button className="secondary-button" onClick={onClose}>{film.monthly && !inline ? "Кино сан руу буцах" : "Кино руу буцах"}</button>
        </div>
      </div>
    );
  }

  const checkout = <>
    {isSimpleMovieTopup ? <>
      <div className="wallet-single-topbar">
        <button type="button" className="wallet-single-back" onClick={onClose} aria-label="Кино руу буцах">←</button>
        <strong>Киноны данс цэнэглэх</strong>
        <span />
      </div>

      {paymentError && <p role="alert" className="checkout-error wallet-single-error">{paymentError}</p>}

      <section className="wallet-single-instructions" aria-label="Киноны данс цэнэглэх заавар">
        <p>Та энэ данс руу</p>
      </section>

      <button type="button" className="wallet-single-copy" onClick={() => copyText(bankAccount.number,"account")}>
        <span><small>Данс · {bankAccount.bank} · IBAN-{String(bankAccount.iban || "").replace(/^MN/i,"")}</small><strong>{bankAccount.number}</strong></span>
        <b>{copied === "account" ? "Хуулагдлаа ✓" : "Хуулах"}</b>
      </button>

      <section className="wallet-single-instructions" aria-label="Цэнэглэх нөхцөл">
        <p><strong>Шилжүүлэх дүн 6,000₮</strong> · <strong>3 кино үзнэ</strong></p>
      </section>

      <button type="button" disabled={!orderReady} className="wallet-single-copy wallet-single-ref" onClick={() => copyText(refCode,"ref")}>
        <span><small>Гүйлгээний утга</small><strong>{orderReady ? refCode : "…"}</strong></span>
        <b>{copied === "ref" ? "Хуулагдлаа ✓" : "Код хуулах"}</b>
      </button>

      <div className="wallet-single-balance">
        Таны кино сайтын дансны одоогийн үлдэгдэл
        <strong>{Number(film.walletBefore||0).toLocaleString()}₮</strong>
      </div>

      <div className="wallet-single-wait" role="status">
        <span className="status-ring" aria-hidden="true"/>
        <div>
          <strong>{autoStatus === "timeout" ? "Шалгах хугацаа дууслаа" : autoStatus === "checking" ? "Төлбөр шалгаж байна…" : "Төлбөрийн SMS хүлээж байна"}</strong>
          <p>{autoStatus === "timeout" ? "Мөнгө шилжүүлсэн бол дахин шилжүүлэхгүй, админтай холбогдоно уу." : "Гүйлгээ баталгаажмагц үлдэгдэл автоматаар нэмэгдэнэ."}</p>
        </div>
      </div>
    </> : <>
      <div className="dialog-heading"><div><span className="eyebrow">ЗАХИАЛГА / {orderReady ? refCode : "…"}</span><h2>Үзэх эрх авах</h2></div><button className="icon-button" onClick={onClose} aria-label="Төлбөрийн цонх хаах"><UiIcon name="close" /></button></div>
      {paymentError && <p role="alert" className="checkout-error">{paymentError}</p>}
      {isWalletTopup && !showTransferDetails && <section className="wallet-topup-box" aria-label="Киноны данс цэнэглэх">
        <h2>Киноны дансаа 5,000₮ ба түүнээс дээш дүнгээр цэнэглэнэ үү</h2>
        <p className="wallet-topup-warning">5,000₮-өөс бага дүнгээр цэнэглэлт орохгүй.</p>
        <div className="wallet-topup-choices" role="group" aria-label="Цэнэглэх дүн">
          {topupChoices.map(amount=><button key={amount} type="button" className={selectedTopup===amount?"selected":""} aria-pressed={selectedTopup===amount} onClick={()=>setSelectedTopup(amount)}>{amount.toLocaleString()}₮</button>)}
        </div>
        <div className="wallet-topup-selected">Сонгосон цэнэглэлт <strong>{selectedTopup.toLocaleString()}₮</strong></div>
        <p className="wallet-spend-note">Сонгосон <strong>{planLabel(film.returnPlan)}</strong> багцыг кино сайтын дансны үлдэгдлээр авна.</p>
        <p className="wallet-credit-note">Гүйлгээний 6 оронтой утга таарч, банкны SMS-д 5,000₮ ба түүнээс дээш дүн ирсэн бол тухайн хэрэглэгчийн үлдэгдэл яг ирсэн дүнгээр цэнэглэгдэнэ.</p>
      </section>}
      <div className="checkout-summary"><div><strong>{isWalletTopup ? "Үлдэгдэл цэнэглэх" : film.title}</strong><span>{isWalletTopup ? "Киноны дансны цэнэглэлт" : film.monthly ? (film.plan?.endsWith("_3day") ? "3 хоногийн үзэх эрх" : "30 хоногийн үзэх эрх") : "Нэг киноны үзэх эрх"}</span></div><strong>{isWalletTopup ? `${selectedTopup.toLocaleString()}₮` : orderAmount===null ? "Дүнг шалгаж байна…" : `${orderAmount.toLocaleString()}₮`}</strong></div>
      {isWalletTopup && !showTransferDetails && <div className="wallet-topup-preview"><span className="wallet-current-balance">Таны кино сайтын дансны үлдэгдэл <strong>{Number(film.walletBefore||0).toLocaleString()}₮</strong></span>{film.returnPlan ? <><span>Багцын үнэ <strong>{Number(film.returnPrice||PLAN_PRICES[film.returnPlan]||0).toLocaleString()}₮</strong></span><span>{selectedTopup.toLocaleString()}₮ цэнэглээд багц авбал <strong>{Math.max(0,Number(film.walletBefore||0)+selectedTopup-Number(film.returnPrice||PLAN_PRICES[film.returnPlan]||0)).toLocaleString()}₮ үлдэнэ</strong></span></> : <><span>Нэг киноны үнэ <strong>2,000₮</strong></span><span>{selectedTopup.toLocaleString()}₮ цэнэглээд 1 кино үзвэл <strong>{Math.max(0,Number(film.walletBefore||0)+selectedTopup-2000).toLocaleString()}₮ үлдэнэ</strong></span></>}</div>}
      {isWalletTopup && !showTransferDetails && <button type="button" className="wallet-open-transfer wallet-open-transfer-simple" disabled={!orderReady} onClick={revealTransferDetails}>Данс цэнэглэх</button>}
      {(!isWalletTopup || showTransferDetails) && <div ref={transferPanelRef} className={isWalletTopup ? "wallet-transfer-panel" : undefined}>
        {isWalletTopup && <div className="wallet-transfer-head wallet-transfer-head-note"><span>5,000₮-өөс дээш дүнгээр цэнэглэнэ үү</span></div>}
        <section className="bank-details"><h3>1. Дансаар шилжүүлэх</h3><dl><div><dt>Банк</dt><dd>{bankAccount.bank}</dd></div><div><dt>Эзэмшигч</dt><dd>{bankAccount.name}</dd></div></dl><button className="copy-account" onClick={() => copyText(bankAccount.number,"account")}><span><span className="account-label-line">Дансны дугаар {bankAccount.iban && <em className="bank-ibn">IBAN {bankAccount.iban}</em>}</span><strong>{bankAccount.number}</strong></span><span>{copied === "account" ? "Хуулагдлаа ✓" : "Хуулах"}</span></button></section>
        <section className={isWalletTopup ? "reference-section wallet-reference-blink" : "reference-section"}><h3>2. Гүйлгээний утгад энэ кодыг бичнэ</h3><button disabled={!orderReady} className="copy-reference" onClick={() => copyText(refCode,"ref")}><strong>{orderReady ? refCode : "…"}</strong><span>{copied === "ref" ? "Хуулагдлаа ✓" : "Код хуулах"}</span></button><p>{orderReady ? "Энэ 6 оронтой утгыг яг хэвээр бичнэ. Утга таарвал таны орсон бодит дүнгээр үлдэгдэл цэнэглэгдэнэ." : "Захиалга үүсэж дуустал мөнгө шилжүүлэхгүй түр хүлээнэ үү."}</p></section>
      </div>}
      <div className="checkout-status" role="status"><span className="status-ring" aria-hidden="true"/><div><strong>{autoStatus === "timeout" ? "Шалгах хугацаа дууслаа" : autoStatus === "checking" ? "Баталгаажуулалт шалгаж байна…" : "Баталгаажуулалтыг хүлээж байна"}</strong><p>{autoStatus === "timeout" ? "Төлбөр шилжүүлсэн бол дахин төлөхөөс өмнө админтай холбогдоно уу." : "Төлбөр баталгаажсаны дараа үзэх эрх нээгдэнэ."}</p></div></div>
      {!isWalletTopup && <>
        <button className="secondary-button checkout-back" disabled={!orderReady || manualChecking} onClick={()=>handleSmsFound(refCode)}>{manualChecking ? "Шалгаж байна…" : "Төлбөрөө шалгах"}</button>
        <button className="secondary-button checkout-back" onClick={onClose}>{film.monthly && !inline ? "Кино сан руу буцах" : "Кино руу буцах"}</button>
      </>}
      {showSms && <SmsVerifyModal onClose={() => setShowSms(false)} onFound={handleSmsFound} />}
    </>}
  </>;
  return inline ? <div className={`checkout-inline${isWalletTopup ? " wallet-topup-checkout" : ""}${isSimpleMovieTopup ? " wallet-single-fullscreen" : ""}`}>{checkout}</div> : <CinemaDialog title="Төлбөр төлөх" onClose={onClose} className={`checkout-dialog${isWalletTopup ? " wallet-topup-checkout" : ""}`}>{checkout}</CinemaDialog>;
}

// ══════════════════════════════════════════════
// ADMIN — мэссэж шалгах таб нэмэгдлээ
// ══════════════════════════════════════════════
function AdminSmsTab() {
  const [smsText, setSmsText] = useState("");
  const [result, setResult] = useState<any>(null);
  const [status, setStatus] = useState<"idle" | "checking" | "found" | "notfound">("idle");

  const extractRef = (text: string): string | null => {
    const match = text.match(/\b(\d{6})\b/);
    if (match) return match[1];
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
          placeholder={"Орлого 5,000₮ Гүйлгээний утга: 476400 ..."}
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
function CinemaDialog({children, title, onClose, className = ""}: {children: React.ReactNode; title: string; onClose: () => void; className?: string}) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const dialog=ref.current;dialog?.showModal();return()=>dialog?.close();},[]);
  return <dialog ref={ref} className={`cinema-dialog ${className}`} aria-label={title} onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>{children}</dialog>;
}
type UiIconName = "play" | "search" | "arrow" | "close" | "user" | "message" | "download" | "film";
function UiIcon({ name, size = 20 }: { name: UiIconName; size?: number }) {
  const paths: Record<UiIconName, React.ReactNode> = {
    play: <path d="m9 5 11 7-11 7Z" />,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    arrow: <path d="M19 12H5m6-6-6 6 6 6" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
    message: <path d="M4 4h16v12H9l-5 4Z" />,
    download: <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />,
    film: <><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M7 3v18M17 3v18M3 8h4m-4 8h4m10-8h4m-4 8h4" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
function Poster({ film }: any) {
  const [failed, setFailed] = useState(false);
  return <div className="poster-art">
    <div className="poster-fallback" aria-hidden="true">
      <span className="poster-wordmark">ТАЗА САЙТ</span>
      <strong>{film.title}</strong>
      <span>{decodeCat(film.badge)} · {decodeBadge(film.badge)}</span>
    </div>
    {film.img && !failed
      ? <img loading="lazy" decoding="async" width="360" height="540" src={film.img} alt="" onError={() => setFailed(true)} />
      : <TrailerPosterFrame film={film} />}
  </div>;
}
function FilmCard({ film, onClick, expiry }: any) {
  const available = film.free || film.locked === false || !!expiry;
  const isErotic = decodeCat(film.badge) === "Эротик";
  return <article className={`movie-card${isErotic ? " erotic-card" : ""}`}>
    <button type="button" className="movie-main" onClick={onClick} aria-label={`${film.title} — дэлгэрэнгүй үзэх`}>
      <div className="movie-poster">
        <Poster key={film.img || "no-image"} film={film} />
        <span className="movie-badge">{decodeBadge(film.badge)}</span>
        {isErotic && <span className="movie-age21">+21</span>}
        {film.free && <span className="movie-free">Үнэгүй</span>}
        <span className="movie-play"><UiIcon name="play" size={25} /></span>
      </div>
      <div className="movie-info">
        <span className="movie-category">{decodeCat(film.badge)}</span>
        <h3>{film.title}</h3>
        <div className="movie-price"><strong className={available ? "available" : ""}>{film.free ? "Үнэгүй үзэх" : available ? "Үзэх эрхтэй" : `${Number(film.price || 0).toLocaleString()}₮`}</strong>
          {!available && Number(film.op) > Number(film.price) && <del>{Number(film.op).toLocaleString()}₮</del>}
        </div>
        {expiry && <span className="movie-expiry">{expiry}</span>}
      </div>
    </button>
    <span className="movie-detail-hint">Трейлер · Дэлгэрэнгүй</span>
  </article>;
}

function ContactModal({ onClose, user, onLogin, admin, onAdmin }: any) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [announcement, setAnnouncement] = useState<any>(null);
  const [messengerUrl, setMessengerUrl] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
    const overflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    requestJson("/api/settings", {}, true).then(data => setMessengerUrl(safeUrl(data?.messengerUrl))).catch(() => {});
    dbFetch("contact_messages?is_announcement=eq.true&order=created_at.desc&limit=1&select=*", {}, true)
      .then(data => setAnnouncement(data?.[0] || null)).catch(() => {});
    return () => { document.body.style.overflow = overflow; };
  }, []);
  const notice = announcement && <details className="chat-public-notice"><summary>📢 Админы мэдэгдэл</summary>
    {announcement.announcement_image && <img src={announcement.announcement_image} alt="Мэдэгдлийн зураг" />}
    <p>{announcement.message}</p>
  </details>;
  return <dialog ref={dialog} className="contact-chat-modal" aria-label="Админтай холбогдох" onCancel={onClose}>
    {user ? <ChatPanel key={user.id} onBack={onClose}>{notice}</ChatPanel> : <div className="chat-signin">
      <button className="chat-icon" onClick={onClose} aria-label="Холбогдох хэсгийг хаах">←</button>
      <h2>Админтай чатлах</h2><p>Нэвтрээд мессеж, зураг илгээж, админы хариуг эндээс уншаарай.</p>
      {admin ? <button className="chat-primary" onClick={onAdmin}>Хэрэглэгчдийн чатыг нээх</button> : <LoginModal onLogin={onLogin} />}
      {messengerUrl && <a className="chat-messenger" href={messengerUrl} target="_blank" rel="noopener noreferrer">PIN мартсан уу? Messenger-ээр холбогдох ↗</a>}
      {notice}
    </div>}
  </dialog>;
}


function LoginModal({ onLogin }: { onLogin: (u: any) => void }) {
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [register, setRegister] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (pending.current) return;
    if (register && pin !== pin2) { setError("PIN давталт таарахгүй байна."); return; }
    pending.current = true; setBusy(true); setError("");
    try {
      const data = await requestJson("/api/auth", { method: "POST", body: JSON.stringify({action:register?"register":"login",phone,pin}) });
      if (!data?.user) throw new Error("Бүртгэлийг баталгаажуулж чадсангүй.");
      onLogin(data.user);
    } catch (err) { setError(err instanceof Error ? err.message : "Алдаа гарлаа."); }
    finally { pending.current = false; setBusy(false); }
  };
  return <form onSubmit={submit} className="simple-auth-form">
    <div role="group" aria-label="Нэвтрэх эсвэл бүртгүүлэх" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:18}}>
      <button type="button" aria-pressed={!register} disabled={busy} onClick={()=>{setRegister(false);setPin("");setPin2("");setError("");}} style={{...goldBtn,background:!register?C.gold:C.card2,color:!register?"#000":C.txt}}>Нэвтрэх</button>
      <button type="button" aria-pressed={register} disabled={busy} onClick={()=>{setRegister(true);setPin("");setPin2("");setError("");}} style={{...goldBtn,background:register?C.gold:C.card2,color:register?"#000":C.txt}}>Бүртгүүлэх</button>
    </div>
    <label style={lbl} htmlFor="user-phone">Утасны дугаар</label>
    <input id="user-phone" type="tel" inputMode="numeric" autoComplete="username" autoFocus required pattern="[0-9]{8}" maxLength={8} value={phone} onChange={e=>{const next=e.target.value.replace(/\D/g,"").slice(0,8);setPhone(next);if(next.length===8)document.getElementById("user-pin")?.focus();}} placeholder="Жишээ: 99112233" style={{...inputSt,padding:"15px 16px",fontSize:18}}/>
    <label style={{...lbl,marginTop:14}} htmlFor="user-pin">4 оронтой PIN код</label>
    <input id="user-pin" type="password" inputMode="numeric" autoComplete={register?"new-password":"current-password"} required pattern="[0-9]{4}" maxLength={4} value={pin} onChange={e=>{const next=e.target.value.replace(/\D/g,"").slice(0,4);setPin(next);if(register&&next.length===4)document.getElementById("user-pin2")?.focus();}} placeholder="••••" style={{...inputSt,padding:"15px 16px",fontSize:18,letterSpacing:"0.2em"}}/>
    {register && <><label style={{...lbl,marginTop:14}} htmlFor="user-pin2">PIN кодоо дахин оруулна уу</label><input id="user-pin2" type="password" inputMode="numeric" autoComplete="new-password" required pattern="[0-9]{4}" maxLength={4} value={pin2} onChange={e=>setPin2(e.target.value.replace(/\D/g,""))} placeholder="••••" style={{...inputSt,padding:"15px 16px",fontSize:18,letterSpacing:"0.2em"}}/></>}
    {error && <p role="alert" style={{color:C.red,marginTop:10}}>{error}</p>}
    <button type="submit" disabled={busy || phone.length!==8 || pin.length!==4 || (register && pin2.length!==4)} style={{...goldBtn,marginTop:18,padding:15,fontSize:16,opacity:(busy || phone.length!==8 || pin.length!==4 || (register && pin2.length!==4))?0.55:1}}>{busy?"Түр хүлээнэ үү...":register?"Бүртгэл үүсгэх":"Нэвтрэх"}</button>
    <p style={{fontSize:12,color:C.muted,marginTop:12,lineHeight:1.6}}>{register?"8 оронтой утасны дугаар, өөрийн 4 оронтой PIN кодоо оруулна уу.":"Бүртгэлгүй бол дээрх “Бүртгүүлэх” товчийг сонгоно уу."}</p>
    <p style={{fontSize:12,color:C.muted,marginTop:6}}>PIN мартсан бол Мессэж хэсгээр админтай холбогдоно уу.</p>
  </form>;
}

function PlanModal({ onSelect, autoOpen, onAutoClose, user, films = [], countsReady = true }: { onSelect: (plan: string) => void; autoOpen?: boolean; onAutoClose?: () => void; user?: any; films?: any[]; countsReady?: boolean }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("gadaad");
  const [duration, setDuration] = useState("3day");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const categories = [{key:"gadaad",label:"Гадаад"},{key:"hyatad",label:"Хятад"},{key:"oros",label:"Орос"},{key:"erotic",label:"Эротик"},{key:"all",label:"Бүх ангилал"}];
  const countFor = (key: string) => films.filter(f => key === "all" ? ["Гадаад","Хятад","Орос","Эротик"].includes(decodeCat(f.badge)) : decodeCat(f.badge) === categories.find(c => c.key === key)?.label).length;
  const plan = category === "all" ? "all_1month" : `${category}_${duration}`;
  const price = PLAN_PRICES[plan];
  const selectedCount = countFor(category);
  useEffect(() => { if (autoOpen) setOpen(true); }, [autoOpen]);
  useEffect(() => {
    const openPreset=(event:Event)=>{
      const detail=(event as CustomEvent<{category?:string;duration?:string}>).detail || {};
      if(detail.category==="erotic"){
        setCategory("erotic");
        setDuration(detail.duration==="1month"?"1month":"3day");
        setOpen(true);
      }
    };
    window.addEventListener("kinoOpenPlanPreset",openPreset as EventListener);
    return()=>window.removeEventListener("kinoOpenPlanPreset",openPreset as EventListener);
  }, []);
  useEffect(() => {
    if (open) dialogRef.current?.showModal(); else dialogRef.current?.close();
  }, [open]);
  const close = () => {setOpen(false);onAutoClose?.();};
  useEffect(() => {if (!open) return; window.addEventListener("popstate", close);return () => window.removeEventListener("popstate", close);}, [open]);
  const select = () => {if(countsReady && selectedCount === 0)return;close();onSelect(plan);};
  return <dialog ref={dialogRef} className="plan-dialog package-dialog" aria-labelledby="package-dialog-title" onCancel={close} onClick={e => {if(e.target === e.currentTarget)close();}}>
      <div className="dialog-heading"><div><span className="eyebrow">ҮЗЭХ ЭРХ</span><h2 id="package-dialog-title">Багцаа сонгоорой</h2></div><button type="button" className="icon-button" aria-label="Багцын сонголт хаах" onClick={close}><UiIcon name="close" /></button></div>
      <fieldset className="package-fieldset"><legend>1. Ямар кино үзэх вэ?</legend><div className="package-choices">
        {categories.map(c => <label key={c.key} className={`package-choice ${category === c.key ? "selected" : ""}`}>
          <input type="radio" name="package-category" value={c.key} checked={category === c.key} onChange={() => {setCategory(c.key);if(c.key === "all")setDuration("1month");}} />
          <span><strong>{c.label}{c.key === "erotic" && <span className="age-label">21+</span>}</strong><span>{c.key === "all" ? "Бүх ангилал" : "Тухайн ангиллын бүх кино"}</span></span>
        </label>)}
      </div><p className="package-hint">{category === "all" ? "Гадаад, хятад, орос, эротик — дөрвөн ангиллын бүх кино." : "Сонгосон ангиллын бүх киног үзнэ."}</p></fieldset>
      <fieldset className="package-fieldset"><legend>2. Хэдий хугацаанд үзэх вэ?</legend><div className="package-durations">
        {(category === "all" ? ["1month"] : ["3day","1month"]).map(d => <label key={d} className={`package-choice ${duration === d ? "selected" : ""}`}>
          <input type="radio" name="package-duration" value={d} checked={duration === d} onChange={() => setDuration(d)} />
          <span><strong>{d === "3day" ? "3 хоног" : "1 сар"}</strong><span>{PLAN_PRICES[category === "all" ? "all_1month" : `${category}_${d}`].toLocaleString()}₮</span></span>
        </label>)}
      </div><p className="package-hint">Төлбөр баталгаажсан үеэс үзэх хугацаа эхэлнэ.</p></fieldset>
      <div className="package-summary" aria-live="polite"><span><strong>{planLabel(plan)}</strong><span>Сонгосон багцын кинонууд</span></span><strong>{price.toLocaleString()}₮</strong></div>
      {countsReady && selectedCount === 0 && <p className="package-hint" role="status">Одоогоор энэ ангилалд кино байхгүй байна. Өөр ангилал сонгоорой.</p>}
      <button type="button" className="primary-button package-continue" disabled={countsReady && selectedCount === 0} onClick={select}>Төлбөр төлөх</button>
    </dialog>;
}

function HomePage({ chatUnread, films, onFilm, onAdmin, loading, loadError, onRetry, user, onLogin, onLogout, onMonthly, onContact, accessMap, onOpenLogin, showPlan, onPlanClose, catalogState, onCatalogChange, preview=false }: any) {
  const [planAutoOpen, setPlanAutoOpen] = useState(false);
  useEffect(() => { if (showPlan) setPlanAutoOpen(true); }, [showPlan]);
  const getExpiry = (filmId: number, category?: string): string | null => {
    if (!user) return null;
    const now = Date.now();
    if (accessMap?.["monthly"] && accessMap["monthly"] > now) {
      const h = Math.ceil((accessMap["monthly"] - now) / 3600000);
      return h > 24 ? `👑 ${Math.ceil(h/24)} хоног үлдсэн` : `👑 ${h}ц үлдсэн`;
    }
    const catMap: any = { "Эротик": "cat_erotic", "Гадаад": "cat_gadaad", "Хятад": "cat_hyatad", "Орос": "cat_oros" };
    if (category && catMap[category] && accessMap?.[catMap[category]] && accessMap[catMap[category]] > now) {
      const h = Math.ceil((accessMap[catMap[category]] - now) / 3600000);
      return h > 24 ? `✅ ${Math.ceil(h/24)} хоног үлдсэн` : `✅ ${h}ц үлдсэн`;
    }
    const key = `film_${filmId}`;
    if (accessMap?.[key] && accessMap[key] > now) {
      const h = Math.ceil((accessMap[key] - now) / 3600000);
      return h > 1 ? `🕐 ${h}ц үлдсэн` : "🕐 <1ц үлдсэн";
    }
    return null;
  };

  const openLogin = () => onOpenLogin();

  const openPlans = () => setPlanAutoOpen(true);
  return <div className="cinema-site">
    <a className="skip-link" href="#catalog">Киноны жагсаалт руу</a>
    <header className="site-header"><div className="header-inner">
      <div className="brand"><AdminEntryLogo onOpen={onAdmin} /><a href="#catalog" aria-label="ТАЗА САЙТ нүүр">ТАЗА САЙТ</a></div>
      <nav className="header-nav" aria-label="Үндсэн цэс"><a href="#catalog" className="nav-current">Кинонууд</a><button onClick={openPlans}>Үзэх багц</button><button onClick={onContact}>Холбогдох<ChatBadge count={chatUnread} /></button></nav>
      <div className="header-actions">
      {user && !user.guest ? <><span className="account-label"><UiIcon name="user" size={16} />{user.phone}</span><button className="quiet-button" onClick={onLogout}>Гарах</button></> : !user ? <button className="primary-button login-button" onClick={openLogin}><UiIcon name="user" size={17} />Нэвтрэх</button> : null}
      </div>
    </div></header>
    <main className="catalog-shell">
      <section className="package-banner hero-mount-host" aria-label="Онцлох кинонууд" />
      {!preview && <PlanModal onSelect={onMonthly} autoOpen={planAutoOpen} onAutoClose={() => {setPlanAutoOpen(false);onPlanClose?.();}} user={user} films={films} countsReady={!loading && !loadError} />}
      <section id="catalog" className="catalog-section" aria-label="Киноны жагсаалт">
        <CatalogBrowser films={films} state={catalogState} onChange={onCatalogChange} loading={loading} error={loadError} onRetry={onRetry}
          renderFilm={(f: any) => <FilmCard film={f} onClick={() => onFilm(f)} expiry={getExpiry(f.id, decodeCat(f.badge))} />}
          renderPromotion={() => <button type="button" className="catalog-plan-banner" onClick={openPlans}><span><strong>Илүү олон кино үзмээр байна уу?</strong><span>3 хоног эсвэл 1 сарын багц</span></span><span className="banner-cta">Багц сонгох →</span></button>} />
      </section>
      <footer className="site-footer"><div><span className="footer-brand-row"><span className="footer-brand">ТАЗА САЙТ</span><span className="footer-admin-entry"><AdminEntryLogo onOpen={onAdmin} /></span></span><span className="footer-note">Киноны цагийг өөртөө.</span></div><div className="footer-links"><button onClick={onContact}><UiIcon name="message" size={16} />Холбогдох<ChatBadge count={chatUnread} /></button><AppInstallButton /></div></footer>
    </main>
  </div>;
}


function VideoPage({ film, onBack }: any) {
  const [videoError,setVideoError]=useState(false);
  const mainUrl = film.url ? film.url.split("|||")[0] : "";
  const { type, src } = getVideoEmbed(mainUrl);
  return (
    <div className="full-player" style={{ background: "#000", position: "fixed", inset: 0, zIndex: 50 }}>
      {videoError ? <div role="alert" className="video-error"><p>Бичлэг ачаалсангүй. Видео холбоос эсвэл холболтыг шалгана уу.</p><button className="secondary-button" onClick={onBack}>Нүүр рүү буцах</button></div> : src ? (
        type === "video"
          ? <video src={src} autoPlay controls playsInline preload="metadata" onError={()=>setVideoError(true)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
          : <iframe title={film.title} referrerPolicy="strict-origin-when-cross-origin" src={src} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }} allow="autoplay; fullscreen; picture-in-picture" />
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: C.muted, fontSize: 14 }}>Видео холбоос байхгүй байна</div>
      )}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, background: "linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)", padding: "16px", transition: "opacity 0.3s", opacity: 1, pointerEvents: "auto" }}>
        <button aria-label="Нүүр рүү буцах" onClick={(e) => { e.stopPropagation(); onBack(); }} style={{ background: "rgba(0,0,0,0.5)", border: "none", color: "#fff", fontSize: 22, cursor: "pointer", borderRadius: 50, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(10px)" }}>←</button>
      </div>
    </div>
  );
}

function AdminLogin({ onEnter, onBack }: any) {
  const [key,setKey]=useState(""); const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
  const pending=useRef(false);
  const go=async(e:React.FormEvent)=>{e.preventDefault();if(pending.current)return;pending.current=true;setBusy(true);setError("");
    try{await requestJson("/api/auth",{method:"POST",body:JSON.stringify({action:"admin",password:key})});onEnter();}
    catch(err){setError(err instanceof Error?err.message:"Нэвтэрч чадсангүй.");}
    finally{pending.current=false;setBusy(false);}
  };
  return <div style={{minHeight:"100vh",display:"grid",placeItems:"center",background:C.bg,padding:24}}><form onSubmit={go} style={{width:"100%",maxWidth:340}}>
    <h1 style={{fontSize:20,color:C.txt,marginBottom:16}}>Админ нэвтрэх</h1>
    <input aria-label="Админы нууц үг" type="password" autoComplete="current-password" required value={key} onChange={e=>setKey(e.target.value)} style={inputSt}/>
    {error&&<p role="alert" style={{color:C.red,marginTop:10}}>{error}</p>}
    <button disabled={busy} style={{...goldBtn,marginTop:12}}>{busy?"Түр хүлээнэ үү...":"Нэвтрэх"}</button>
    <button type="button" disabled={busy} onClick={onBack} style={{...goldBtn,marginTop:8,background:C.card2,color:C.txt}}>Буцах</button>
  </form></div>;
}

function AdminOrdersTab() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [films, setFilms] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "confirmed" | "expired" | "revoked" | "monthly">("all");
  const [search, setSearch] = useState("");

  const load = async () => {
    try {
    setLoading(true);
    try {
      const [pend, fl, us] = await Promise.all([
        dbAll("pending_payments?select=*"),
        dbAll("films?select=id,title"),
        dbAll("users?select=id,phone,user_id,browser_no,is_guest"),
      ]);
      setOrders(Array.isArray(pend) ? pend : []);
      setFilms(Array.isArray(fl) ? fl : []);
      setUsers(Array.isArray(us) ? us : []);
    } catch(e) {
      setOrders([]); setFilms([]); setUsers([]);
    } finally {
      setLoading(false);
    }
  
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const confirmOrder = async (order: any) => {
    const ref_code=String(order?.ref_code||"");
    if(!ref_code)return;
    let actualAmount:Number|number=Number(order?.amount||0);
    if(order?.plan==="wallet_topup"){
      const entered=window.prompt("Банкны дансанд БОДИТОЙ орсон дүнг оруулна уу.\nЖишээ: 13000",String(Number(order?.amount||5000)));
      if(entered===null)return;
      actualAmount=Number(entered.replace(/[^0-9]/g,""));
      if(!Number.isSafeInteger(actualAmount)||Number(actualAmount)<5000||Number(actualAmount)>200000){alert("5,000₮-өөс 200,000₮ хүртэл бодит дүн оруулна уу.");return;}
    }
    setConfirming(ref_code);
    try {
      await dbFetch(`pending_payments?ref_code=eq.${ref_code}`, {
        method: "PATCH",
        body: JSON.stringify({status:"confirmed",confirmed_at:new Date().toISOString(),...(order?.plan==="wallet_topup"?{confirmed_amount:Number(actualAmount)}:{})}),
      });
      await load();
    } catch(e) {
      alert(e instanceof Error ? e.message : "Баталгаажуулахад алдаа гарлаа");
    } finally {
      setConfirming(null);
    }
  };

  const revokeOrder = async (ref_code: string) => {
    if (!window.confirm("Зөвхөн энэ захиалгын эрхийг хасах уу?")) return;
    await dbFetch(`pending_payments?ref_code=eq.${ref_code}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "revoked" }),
    });
    await load();
  };


  const getFilmTitle = (id: number) => id === 0 ? "👑 Сарын багц" : films.find((f: any) => f.id === id)?.title || `#${id}`;
  const getPhone = (uid: number, order?: any) => {
    const u=uid?users.find((row:any)=>row.id===uid):null;
    if(u?.browser_no)return u.is_guest ? `Төхөөрөмж #${u.browser_no} · ${u.user_id||u.phone}` : `#${u.browser_no} · ${u.phone||u.user_id}`;
    if(order?.phone)return order.phone;
    return u?.phone || "—";
  };
  const statusColor = (s: string) => s === "confirmed" ? C.green : s === "pending" ? C.gold : C.red;
  const statusLabel = (s: string) => s === "confirmed" ? "✅ Баталгаажсан" : s === "expired" ? "⌛ Хугацаа дууссан" : s === "revoked" ? "🚫 Хасагдсан" : "⏳ Хүлээгдэж байна";

  const filtered = orders.filter((o: any) => {
    if (filter === "all") { }
    else if (filter === "monthly") { if (!o.plan || o.plan === "single" || o.plan === "wallet_topup" || o.plan === "wallet_admin") return false; }
    else { if (o.status !== filter) return false; }
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      const phone = getPhone(o.user_id, o).toLowerCase();
      const ref = (o.ref_code || "").toLowerCase();
      return phone.includes(s) || ref.includes(s);
    }
    return true;
  });

  const totalRevenue = orders.filter(o => o.status === "confirmed").reduce((s, o) => s + Number(o.amount || 0), 0);
  const pendingCount = orders.filter(o => o.status === "pending").length;
  const confirmedCount = orders.filter(o => o.status === "confirmed").length;
  const monthlyCount = orders.filter(o => o.plan && o.plan !== "single" && o.plan !== "wallet_topup" && o.plan !== "wallet_admin" && o.status === "confirmed").length;

  const filters: { key: typeof filter; label: string }[] = [
    { key: "all", label: `Бүгд ${orders.length}` },
    { key: "pending", label: `⏳ ${pendingCount}` },
    { key: "confirmed", label: `✅ ${confirmedCount}` },
    { key: "expired", label: `⌛ Хугацаа дууссан` },
    { key: "monthly", label: `👑 ${monthlyCount}` },
    { key: "revoked", label: `🚫 Хасагдсан` },
  ];

  return (
    <div style={{ padding: "0 14px" }}>
      {/* Статистик */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        <div style={{ background: "#052e16", border: `0.5px solid ${C.green}`, borderRadius: 10, padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: C.muted }}>Сүүлийн 100 захиалгын орлого</div>
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

      {/* Хайлт */}
      <input
        style={{ ...inputSt, marginBottom: 12 }}
        value={search}
        onChange={(e: any) => setSearch(e.target.value)}
        placeholder="📞 Дугаар эсвэл 🔑 KN код хайх..."
      />

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
                <div style={{ fontSize: 12, color: C.txt, marginTop: 2 }}>{o.plan && o.plan !== "single" ? planLabel(o.plan) : getFilmTitle(o.film_id)}</div>
                <div style={{ fontSize: 12, color: C.gold, marginTop: 2 }}>📞 {getPhone(o.user_id, o)}</div>
                {o.plan && o.plan !== "single" && <div style={{ fontSize: 11, color: "#a855f7", marginTop: 2 }}>👑 Үзэх багц</div>}
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
                <button onClick={() => confirmOrder(o)} disabled={confirming === o.ref_code}
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
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function AdminMembersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [allPayments, setAllPayments] = useState<any[]>([]);
  const [films, setFilms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterTab, setFilterTab] = useState<"allbag"|"monthly"|"3day"|"film">("allbag");
  const [revoking, setRevoking] = useState<string | null>(null);
  // Нийт гишүүд харах
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [allSearch, setAllSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  // Эрх өгөх
  const [grantUser, setGrantUser] = useState<any>(null);
  const [granting, setGranting] = useState(false);
  const [grantFilmId, setGrantFilmId] = useState<number | null>(null);
  const [grantStep, setGrantStep] = useState<"main"|"month_cat"|"3day_cat"|"film"|"revoke">("main");
  const [userPayments, setUserPayments] = useState<any[]>([]);
  const [loadingUserPayments, setLoadingUserPayments] = useState(false);

  useEffect(() => {
    const handleBack = () => {
      if (showAllUsers) {
        setShowAllUsers(false);
        setAllSearch("");
        setGrantUser(null);
        setGrantStep("main");
        window.history.pushState({ page: "admin" }, "");
      }
    };
    window.addEventListener("adminBackPress", handleBack);
    return () => window.removeEventListener("adminBackPress", handleBack);
  }, [showAllUsers]);

  const load = async () => {
    try {
    setLoading(true);
    try {
      const [us, fl, pay] = await Promise.all([
        dbAll("users?select=*"),
        dbAll("films?select=id,title"),
        dbAll("pending_payments?status=eq.confirmed&select=id,user_id,film_id,plan,amount,created_at,confirmed_at,ref_code,phone"),
      ]);
      setUsers(Array.isArray(us) ? us.filter((u:any)=>u.is_guest!==true) : []);
      setFilms(Array.isArray(fl) ? fl : []);
      setAllPayments(Array.isArray(pay) ? pay.filter((p:any)=>!us.find((u:any)=>u.id===p.user_id)?.is_guest) : []);
    } catch(e) {
      setUsers([]); setFilms([]); setAllPayments([]);
    } finally {
      setLoading(false);
    }
  
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const getPhone = (userId: number) => {
    const p = allPayments.find(p => p.user_id === userId);
    return p?.phone || users.find(u => u.id === userId)?.phone || "—";
  };

  // Хугацаа дуусаагүй эрхүүдийг шүүх
  const now = Date.now();
  const isActive = (p: any) => paymentExpiry({...p,status:"confirmed"}) > now;
  const activePayments = allPayments.filter(p => p.plan !== "wallet_topup" && isActive(p));

  const paymentsAllBag = activePayments.filter(p => ["all_1month","monthly","1month","3day","1year"].includes(p.plan));
  const paymentsMonthly = activePayments.filter(p => p.plan && p.plan.endsWith("_1month") && p.plan !== "all_1month");
  const payments3Day = activePayments.filter(p => p.plan && p.plan.endsWith("_3day"));
  const paymentsFilm = activePayments.filter(p => !p.plan || p.plan === "single");
  const revocableUserPayments = userPayments.filter((p:any) => p.plan !== "wallet_topup" && isActive(p));
  const totalWithAccess = new Set(activePayments.map(p => p.user_id)).size;

  const currentPayments = filterTab === "allbag" ? paymentsAllBag : filterTab === "monthly" ? paymentsMonthly : filterTab === "3day" ? payments3Day : paymentsFilm;
  const filteredPayments = currentPayments.filter(p => !search.trim() || getPhone(p.user_id).includes(search.trim()));

  const revokePayment = async (ref_code: string) => {
    try {
    if (!window.confirm("Зөвхөн сонгосон кино эсвэл багцын эрхийг хасах уу?")) return;
    setRevoking(ref_code);
    await dbFetch(`pending_payments?ref_code=eq.${ref_code}`, { method: "PATCH", body: JSON.stringify({ status: "revoked" }) });
    setUserPayments(ps => ps.filter(p => p.ref_code !== ref_code));
    await load();
    setRevoking(null);
  
    } finally { setRevoking(null); }
  };

  // Гишүүний эрхүүдийг татах
  const loadUserPayments = async (userId: number) => {
    try {
    setLoadingUserPayments(true);
    const data = await dbFetch(`pending_payments?user_id=eq.${userId}&status=eq.confirmed&select=*&order=created_at.desc`);
    setUserPayments(Array.isArray(data) ? data : []);
    setLoadingUserPayments(false);
  
    } finally { setLoadingUserPayments(false); }
  };

  // Эрх өгөх функц
  const grantAccess = async (plan: string, filmId?: number) => {
    try {
    if (!grantUser) return;
    setGranting(true);
    const ref_code = genRef();
    const isSingle = plan === "single";
    await dbFetch("pending_payments", {
      method: "POST",
      body: JSON.stringify({
        ref_code,
        film_id: isSingle ? filmId : null,
        amount: 0,
        status: "confirmed",
        user_id: grantUser.id,
        phone: grantUser.phone || null,
        plan,
        confirmed_at: new Date().toISOString(),
      }),
    });
    await load();
    setGranting(false);
    setGrantUser(null);
    setGrantFilmId(null);
    setGrantStep("main");
    alert("✅ Эрх амжилттай олгогдлоо!");
  
    } catch(error) {
      alert(error instanceof Error ? error.message : "Эрх олгож чадсангүй. Дахин шалгана уу.");
    } finally { setGranting(false); }
  };

  const tabLabel = filterTab === "allbag" ? "🌟 Бүх багц авсан гишүүд" : filterTab === "monthly" ? "👑 1 сарын эрхтэй гишүүд" : filterTab === "3day" ? "⏱ 3 хоногийн эрхтэй гишүүд" : "🎬 1 кино эрхтэй гишүүд";

  // ── Нийт гишүүдийн жагсаалт дэлгэц ──
  if (showAllUsers) {
    const filtered = allSearch.trim().length >= 3 ? searchResults : (allSearch.trim() ? [] : users);
    return (
      <div style={{ padding: "0 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <button onClick={() => { setShowAllUsers(false); setAllSearch(""); setGrantUser(null); }}
            style={{ background: "none", border: "none", color: C.muted, fontSize: 22, cursor: "pointer" }}>←</button>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.txt }}>Нийт гишүүд ({users.length})</span>
          <button onClick={load} style={{ marginLeft: "auto", background: C.card2, border: `0.5px solid ${C.bd}`, borderRadius: 8, padding: "6px 10px", color: C.muted, fontSize: 12, cursor: "pointer" }}>🔄</button>
        </div>
        {/* Хайлт */}
        <div style={{ position: "relative", marginBottom: 12 }}>
          <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: C.muted, fontSize: 13 }}>🔍</span>
          <input value={allSearch} onChange={async (e: any) => {
              const val = e.target.value;
              setAllSearch(val);
              if (val.trim().length >= 3) {
                setSearching(true);
                const res = await dbFetch(`users?phone=like.*${val.replace(/\D/g,"").slice(0,8)}*&select=*&limit=50`);
                setSearchResults(Array.isArray(res) ? res : []);
                setSearching(false);
              } else {
                setSearchResults([]);
              }
            }}
            placeholder="Дугаар хайх (3+ цифр)..."
            style={{ ...inputSt, paddingLeft: 28, padding: "8px 10px 8px 28px", fontSize: 12 }} />
          {searching && <div style={{ fontSize: 11, color: C.muted, marginTop: 4, paddingLeft: 4 }}>Хайж байна...</div>}
        </div>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: C.muted }}>Ачааллаж байна...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 30, color: C.muted }}>Гишүүн олдсонгүй</div>
        ) : filtered.map((u: any) => {
          const uActive = activePayments.filter((p: any) => p.user_id === u.id);
          return (
          <div key={u.id} onClick={() => { setGrantUser(u); setGrantStep("main"); loadUserPayments(u.id); }}
            style={{ background: C.card, border: `0.5px solid ${grantUser?.id === u.id ? C.gold : uActive.length > 0 ? "#16a34a" : C.bd}`, borderRadius: 12, padding: "12px 14px", marginBottom: 8, cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.gold }}>📞 {u.phone}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>ID: {u.user_id} · {new Date(u.created_at || Date.now()).toLocaleDateString("mn-MN")}</div>
                {uActive.length > 0 && (
                  <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {uActive.map((p: any) => {
                      const expiry = paymentExpiry({...p,status:"confirmed"});
                      const remaining = Math.ceil((expiry - now) / (60*60*1000));
                      const days = Math.floor(remaining / 24);
                      const hrs = remaining % 24;
                      const timeStr = days > 0 ? days + "өдөр " + hrs + "цаг" : remaining + "цаг";
                      return (
                        <span key={p.ref_code} style={{ fontSize: 10, background: "#052e16", border: "0.5px solid #16a34a", borderRadius: 6, padding: "2px 6px", color: "#4ade80" }}>
                          {planLabel(p.plan)} · {timeStr}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
              <span style={{ color: C.muted, fontSize: 16 }}>›</span>
            </div>
          </div>
          );
        })}

        {/* Эрх өгөх панел */}
        {grantUser && (
          <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 200, background: C.card2, border: `1.5px solid ${C.gold}`, borderRadius: "14px 14px 0 0", padding: "16px 14px", maxHeight: "80vh", overflowY: "auto", boxShadow: "0 -4px 24px rgba(0,0,0,0.7)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 12, color: C.muted }}>Эрх өгөх хэрэглэгч</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.gold }}>📞 {grantUser.phone}</div>
              </div>
              <button onClick={() => { setGrantUser(null); setGrantFilmId(null); setGrantStep("main"); }}
                style={{ background: "none", border: "none", color: C.muted, fontSize: 22, cursor: "pointer" }}>✕</button>
            </div>
            {/* Үндсэн — Эрх өгөх / Эрх хасах сонголт */}
            {grantStep === "main" && (
              <div>
                {/* Идэвхтэй эрхүүд */}
                {userPayments.filter((p: any) => {
                  const expiry = paymentExpiry({...p,status:"confirmed"});
                  return p.plan !== "wallet_topup" && expiry > now;
                }).length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>✅ Идэвхтэй эрхүүд:</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {userPayments.filter((p: any) => {
                        const expiry = paymentExpiry({...p,status:"confirmed"});
                        return p.plan !== "wallet_topup" && expiry > now;
                      }).map((p: any) => {
                        const expiry = paymentExpiry({...p,status:"confirmed"});
                        const remaining = Math.ceil((expiry - now) / (60*60*1000));
                        const days = Math.floor(remaining / 24);
                        const hrs = remaining % 24;
                        const timeStr = days > 0 ? days + "өдөр " + hrs + "цаг үлдсэн" : remaining + "цаг үлдсэн";
                        return (
                          <div key={p.ref_code} style={{ background: "#052e16", border: "0.5px solid #16a34a", borderRadius: 8, padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: "#4ade80" }}>{planLabel(p.plan)}</div>
                              <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>⏰ {timeStr}</div>
                            </div>
                            <div style={{ fontSize: 10, color: C.muted }}>{new Date(p.confirmed_at || p.created_at).toLocaleDateString("mn-MN")}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>Эрх нэмэх:</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                  {[
                    ["all_1month", "🌟", "Бүх багц",      "#1a0a3a", "#f59e0b", "#fcd34d"],
                    ["month_cat",  "👑", "1 сарын эрх",   "#2a0550", "#a855f7", "#e9d5ff"],
                    ["3day_cat",   "⏱", "3 хоногийн эрх","#061220", "#38bdf8", "#7dd3fc"],
                    ["film",       "🎬", "1 кино эрх",    "#031a0e", "#16a34a", "#4ade80"],
                  ].map(([key, icon, label, bg, border, color]) => (
                    <button key={key} disabled={granting}
                      onClick={() => {
                        if (key === "all_1month") grantAccess("all_1month");
                        else setGrantStep(key as any);
                      }}
                      style={{ background: bg as string, border: `0.5px solid ${border}`, borderRadius: 10, padding: "12px 10px", cursor: "pointer", textAlign: "left", opacity: granting ? 0.6 : 1 }}>
                      <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: color as string }}>{label}</div>
                    </button>
                  ))}
                </div>
                <button onClick={() => setGrantStep("revoke")}
                  style={{ width: "100%", background: "#1a0505", border: `0.5px solid ${C.red}`, borderRadius: 10, padding: "11px 14px", color: C.red, fontSize: 13, fontWeight: 700, cursor: "pointer", textAlign: "left" }}>
                  🚫 Эрх хасах
                </button>
              </div>
            )}

            {/* 1 сарын эрх — багц сонгох */}
            {grantStep === "month_cat" && (
              <div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>👑 1 сарын — аль багц?</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    ["erotic_1month", "🔞 Эротик · 1 сар"],
                    ["gadaad_1month", "🌍 Гадаад · 1 сар"],
                    ["hyatad_1month", "🇨🇳 Хятад · 1 сар"],
                    ["oros_1month", "🇷🇺 Орос · 1 сар"],
                  ].map(([plan, label]) => (
                    <button key={plan} onClick={() => grantAccess(plan as string)} disabled={granting}
                      style={{ background: "#2a0550", border: `0.5px solid #a855f7`, borderRadius: 10, padding: "12px 14px", color: "#e9d5ff", fontSize: 13, fontWeight: 700, cursor: "pointer", textAlign: "left", opacity: granting ? 0.6 : 1 }}>
                      {label}
                    </button>
                  ))}
                </div>
                <button onClick={() => setGrantStep("main")} style={{ background: "none", border: "none", color: C.muted, fontSize: 12, cursor: "pointer", marginTop: 10 }}>← Буцах</button>
              </div>
            )}

            {/* 3 хоногийн эрх — багц сонгох */}
            {grantStep === "3day_cat" && (
              <div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>⏱ 3 хоног — аль багц?</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    ["erotic_3day", "🔞 Эротик · 3 хоног"],
                    ["gadaad_3day", "🌍 Гадаад · 3 хоног"],
                    ["hyatad_3day", "🇨🇳 Хятад · 3 хоног"],
                    ["oros_3day", "🇷🇺 Орос · 3 хоног"],
                  ].map(([plan, label]) => (
                    <button key={plan} onClick={() => grantAccess(plan as string)} disabled={granting}
                      style={{ background: "#061220", border: `0.5px solid #38bdf8`, borderRadius: 10, padding: "12px 14px", color: "#7dd3fc", fontSize: 13, fontWeight: 700, cursor: "pointer", textAlign: "left", opacity: granting ? 0.6 : 1 }}>
                      {label}
                    </button>
                  ))}
                </div>
                <button onClick={() => setGrantStep("main")} style={{ background: "none", border: "none", color: C.muted, fontSize: 12, cursor: "pointer", marginTop: 10 }}>← Буцах</button>
              </div>
            )}

            {/* 1 кино — кино сонгох */}
            {grantStep === "film" && (
              <div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>🎬 Кино сонгох:</div>
                <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                  {films.map((f: any) => (
                    <button key={f.id} onClick={() => grantAccess("single", f.id)} disabled={granting}
                      style={{ background: C.card, border: `0.5px solid ${C.bd}`, borderRadius: 8, padding: "10px 12px", color: C.txt, fontSize: 13, cursor: "pointer", textAlign: "left", opacity: granting ? 0.6 : 1 }}>
                      🎬 {f.title}
                    </button>
                  ))}
                </div>
                <button onClick={() => setGrantStep("main")} style={{ background: "none", border: "none", color: C.muted, fontSize: 12, cursor: "pointer", marginTop: 8 }}>← Буцах</button>
              </div>
            )}

            {/* Эрх хасах */}
            {grantStep === "revoke" && (
              <div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>🚫 Идэвхтэй эрхүүд:</div>
                {loadingUserPayments ? (
                  <div style={{ textAlign: "center", color: C.muted, padding: 16 }}>Ачааллаж байна...</div>
                ) : revocableUserPayments.length === 0 ? (
                  <div style={{ textAlign: "center", color: C.muted, padding: 14, background: C.card, borderRadius: 10 }}>Идэвхтэй эрх байхгүй</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {revocableUserPayments.map((p: any) => (
                      <div key={p.ref_code} style={{ background: C.card, border: `0.5px solid ${C.bd}`, borderRadius: 10, padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: C.txt }}>{planLabel(p.plan)}</div>
                          <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{new Date(p.created_at).toLocaleDateString("mn-MN")} · {p.amount?.toLocaleString()}₮</div>
                        </div>
                        <button onClick={() => revokePayment(p.ref_code)} disabled={revoking === p.ref_code}
                          style={{ background: "#1a0505", border: `0.5px solid ${C.red}`, borderRadius: 8, padding: "6px 12px", color: C.red, fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0, opacity: revoking === p.ref_code ? 0.5 : 1 }}>
                          {revoking === p.ref_code ? "..." : "🚫 Хасах"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={() => setGrantStep("main")} style={{ background: "none", border: "none", color: C.muted, fontSize: 12, cursor: "pointer", marginTop: 10 }}>← Буцах</button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Үндсэн дэлгэц ──
  return (
    <div style={{ padding: "0 14px" }}>
      {/* Нийт тоо — дарахад жагсаалт нээгдэнэ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        <div onClick={() => { window.history.pushState({ page: "admin-members" }, ""); setShowAllUsers(true); }}
          style={{ background: C.card, border: `0.5px solid ${C.blue}`, borderRadius: 10, padding: 12, cursor: "pointer" }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Нийт гишүүн</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.txt }}>{loading ? "..." : users.length}</div>
          <div style={{ fontSize: 10, color: C.blue, marginTop: 4 }}>Дарж харах →</div>
        </div>
        <div style={{ background: C.card, border: `0.5px solid ${C.bd}`, borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Эрхтэй гишүүн</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.gold }}>{loading ? "..." : totalWithAccess}</div>
        </div>
      </div>

      {/* 4 filter таб */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
        {([
          ["allbag",  "🌟", "Бүх багц",      "#1a0a3a", "#f59e0b", "#fcd34d", paymentsAllBag.length],
          ["monthly", "👑", "1 сарын эрх",   "#2a0550", "#a855f7", "#e9d5ff", paymentsMonthly.length],
          ["3day",    "⏱", "3 хоногийн эрх","#061220", "#38bdf8", "#7dd3fc", payments3Day.length],
          ["film",    "🎬", "1 кино эрх",    "#031a0e", "#16a34a", "#4ade80", paymentsFilm.length],
        ] as any[]).map(([k, icon, label, bg, border, color, count]) => (
          <div key={k} onClick={() => { setFilterTab(k); setSearch(""); }}
            style={{ background: bg, border: `${filterTab === k ? "2px" : "0.5px"} solid ${border}`, borderRadius: 10, padding: "11px 10px", cursor: "pointer" }}>
            <div style={{ fontSize: 16, marginBottom: 4 }}>{icon}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color, marginTop: 2 }}>{loading ? "..." : count}</div>
          </div>
        ))}
      </div>

      {/* Гарчиг + Хайлт */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{tabLabel}</span>
        <div style={{ flex: 1, position: "relative" }}>
          <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: C.muted, fontSize: 13 }}>🔍</span>
          <input value={search} onChange={(e: any) => setSearch(e.target.value)} placeholder="Дугаар хайх..."
            style={{ ...inputSt, paddingLeft: 28, padding: "7px 10px 7px 28px", fontSize: 12 }} />
        </div>
        <button onClick={load} style={{ background: C.card2, border: `0.5px solid ${C.bd}`, borderRadius: 8, padding: "7px 10px", color: C.muted, fontSize: 12, cursor: "pointer", flexShrink: 0 }}>🔄</button>
      </div>

      {/* Эрхтэй гишүүдийн жагсаалт */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: C.muted }}>Ачааллаж байна...</div>
      ) : filteredPayments.length === 0 ? (
        <div style={{ textAlign: "center", padding: 30, color: C.muted }}>Гишүүн олдсонгүй</div>
      ) : (
        filteredPayments.map((p: any) => (
          <div key={p.ref_code} style={{ background: C.card, border: `0.5px solid ${C.bd}`, borderRadius: 12, padding: "13px 14px", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.gold }}>📞 {getPhone(p.user_id)}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{new Date(p.created_at).toLocaleDateString("mn-MN")} · {p.amount?.toLocaleString()}₮</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, paddingTop: 10, borderTop: `0.5px solid ${C.bd}` }}>
              <span style={{
                borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700,
                background: p.plan === "all_1month" ? "#1a0a3a" : p.plan?.endsWith("_1month") ? "#3b0764" : p.plan?.endsWith("_3day") ? "#0a1628" : "#052e16",
                border: `0.5px solid ${p.plan === "all_1month" ? "#f59e0b" : p.plan?.endsWith("_1month") ? "#a855f7" : p.plan?.endsWith("_3day") ? "#38bdf8" : "#16a34a"}`,
                color: p.plan === "all_1month" ? "#fcd34d" : p.plan?.endsWith("_1month") ? "#e9d5ff" : p.plan?.endsWith("_3day") ? "#7dd3fc" : "#4ade80",
              }}>{planLabel(p.plan)}</span>
              <button onClick={() => revokePayment(p.ref_code)} disabled={revoking === p.ref_code}
                style={{ background: "#1a0505", border: `0.5px solid ${C.red}`, borderRadius: 8, padding: "7px 14px", color: C.red, fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: revoking === p.ref_code ? 0.5 : 1 }}>
                {revoking === p.ref_code ? "..." : "🚫 Эрх хасах"}
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function AdminAnnouncements() {
  const [annText, setAnnText] = useState("");
  const [annImage, setAnnImage] = useState("");
  const [annSaving, setAnnSaving] = useState(false);
  const [announcement, setAnnouncement] = useState<any>(null);
  const [showAnnForm, setShowAnnForm] = useState(false);

  const loadAnnouncement = async () => {
    const data = await dbFetch("contact_messages?is_announcement=eq.true&order=created_at.desc&limit=1&select=*");
    setAnnouncement(Array.isArray(data) && data.length > 0 ? data[0] : null);
  };

  const saveAnnouncement = async () => {
    if (!annText.trim()) return;
    setAnnSaving(true);
    try {
      const res = await dbFetch(announcement?.id ? `contact_messages?id=eq.${announcement.id}` : "contact_messages", { method: announcement?.id ? "PATCH" : "POST", body: JSON.stringify({ message: annText.trim(), announcement_image: annImage.trim() || null, is_announcement: true, read: true, phone: "admin" }) });
      if (Array.isArray(res) && res.length > 0) {
        setAnnouncement(res[0]);
      } else {
        await loadAnnouncement();
      }
      setAnnText("");
      setAnnImage("");
      setShowAnnForm(false);
    } catch(e) {
      alert("Хадгалахад алдаа гарлаа");
    }
    setAnnSaving(false);
  };

  const deleteAnnouncement = async () => {
    if(!announcement?.id || !window.confirm("Энэ зарыг устгах уу?"))return;
    await dbFetch(`contact_messages?id=eq.${announcement.id}`, { method: "DELETE" });
    await loadAnnouncement();
  };

  useEffect(() => { void loadAnnouncement().catch(() => {}); }, []);
  return <div>
      {/* Зар — Админ бичих хэсэг */}
      <div style={{ marginBottom: 16 }}>
        {!showAnnForm ? (
          <div>
            {announcement ? (
              <div style={{ background: "#1a0a3a", border: "1.5px solid #f59e0b", borderRadius: 14, padding: "14px 16px", marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700 }}>📢 Одоогийн зар</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => { setAnnText(announcement.message); setAnnImage(announcement.announcement_image || ""); setShowAnnForm(true); }}
                      style={{ background: C.card2, border: `0.5px solid ${C.bd}`, borderRadius: 6, padding: "4px 10px", color: C.muted, fontSize: 11, cursor: "pointer" }}>✏️ Засах</button>
                    <button onClick={deleteAnnouncement}
                      style={{ background: "#1a0505", border: `0.5px solid ${C.red}`, borderRadius: 6, padding: "4px 10px", color: C.red, fontSize: 11, cursor: "pointer" }}>🗑️</button>
                  </div>
                </div>
                {announcement.announcement_image && (
                  <img src={announcement.announcement_image} alt="" style={{ width: "100%", borderRadius: 10, marginBottom: 8, maxHeight: 160, objectFit: "cover" }} />
                )}
                <div style={{ fontSize: 13, color: C.txt, lineHeight: 1.6 }}>{announcement.message}</div>
              </div>
            ) : (
              <button onClick={() => setShowAnnForm(true)}
                style={{ width: "100%", background: "#1a0a3a", border: "1.5px dashed #f59e0b", borderRadius: 14, padding: "14px", color: "#f59e0b", fontSize: 13, fontWeight: 700, cursor: "pointer", textAlign: "center" }}>
                📢 Зар / мэдэгдэл нэмэх
              </button>
            )}
          </div>
        ) : (
          <div style={{ background: C.card2, border: `1.5px solid ${C.gold}`, borderRadius: 14, padding: "14px 16px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.gold, marginBottom: 12 }}>📢 Зар бичих</div>
            <label style={lbl}>Текст</label>
            <textarea value={annText} onChange={(e: any) => setAnnText(e.target.value)}
              placeholder="Хэрэглэгчдэд харуулах мэдэгдэл..."
              style={{ ...inputSt, height: 90, resize: "none", lineHeight: 1.6, marginBottom: 10 }} />
            <label style={lbl}>Зургийн URL (заавал биш)</label>
            <input value={annImage} onChange={(e: any) => setAnnImage(e.target.value)}
              placeholder="https://i.imgbb.com/..."
              style={{ ...inputSt, marginBottom: 12 }} />
            {annImage.trim() && (
              <img src={annImage.trim()} alt="" style={{ width: "100%", borderRadius: 10, marginBottom: 10, maxHeight: 140, objectFit: "cover" }} />
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={saveAnnouncement} disabled={annSaving || !annText.trim()}
                style={{ flex: 1, background: C.gold, border: "none", borderRadius: 10, padding: "11px", color: "#000", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: annSaving ? 0.6 : 1 }}>
                {annSaving ? "Хадгалж байна..." : "✅ Хадгалах"}
              </button>
              <button onClick={() => { setShowAnnForm(false); setAnnText(""); setAnnImage(""); }}
                style={{ background: C.card, border: `0.5px solid ${C.bd}`, borderRadius: 10, padding: "11px 16px", color: C.muted, fontSize: 13, cursor: "pointer" }}>Болих</button>
            </div>
          </div>
        )}
      </div>

  </div>;
}

function EditFilmPanel({ f, onDone }: any) {
  const mainUrl = f.url ? f.url.split("|||")[0] : "";
  const existingPreview = f.preview_url || (f.url && f.url.includes("|||") ? f.url.split("|||")[1] : "");
  const [title, setTitle] = useState(f.title);
  const [description, setDescription] = useState(f.description || "");
  const [price, setPrice] = useState(String(f.price ?? 2000));
  const [op, setOp] = useState(String(f.op ?? 6000));
  const [url, setUrl] = useState(mainUrl);
  const [img, setImg] = useState(f.img || "");
  const [previewUrl, setPreviewUrl] = useState(existingPreview);
  const [badge, setBadge] = useState(decodeBadge(f.badge));
  const [category, setCategory] = useState(decodeCat(f.badge));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const savingRef = useRef(false);
  const trailerEditorRef = useRef<TrailerEditorHandle>(null);
  const [trailerBusy, setTrailerBusy] = useState(false);

  const save = async () => {
    if (savingRef.current || uploading || trailerBusy) return;
    if (!title.trim()) { alert("Гарчиг оруулна уу"); return; }
    savingRef.current=true;setSaving(true);
    try {
      const nextPreview = (await trailerEditorRef.current?.prepare()) ?? previewUrl;
      const combinedUrl = nextPreview ? `${url.trim()}|||${nextPreview}` : url.trim();
      const payload: any = { title: title.trim(), price: Number(price), op: Number(op), url: combinedUrl, badge: encodeBadgeCat(badge, category) };
      payload.img = img.trim();
      payload.preview_url = nextPreview.trim();
      if(description.trim() || typeof f.description === "string")payload.description=description.trim();
      const res = await dbFetch(`films?id=eq.${f.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      if (!Array.isArray(res) || res.length === 0) { alert("Алдаа: " + (res?.message || "Өөрчлөлт баталгаажаагүй.")); return; }
      onDone();
    } catch(e: any) {
      if (e?.name === "AbortError") return;
      alert("Алдаа: " + (e?.message || "Дахин оролдоно уу"));
    } finally {
      savingRef.current=false;setSaving(false);
    }
  };

  return (
    <fieldset disabled={saving || trailerBusy} style={{ minWidth: 0, padding: 0, border: 0, marginTop: 10, borderTop: `0.5px solid ${C.bd}`, paddingTop: 10 }}>
      <label style={lbl}>Гарчиг</label>
      <input style={inputSt} value={title} onChange={(e: any) => setTitle(e.target.value)} />
      <label style={{...lbl,marginTop:10}} htmlFor={`film-description-${f.id}`}>Киноны тайлбар</label>
      <textarea id={`film-description-${f.id}`} style={inputSt} rows={5} maxLength={4000} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Киноны үйл явдлыг товч танилцуулаарай." />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
        <div>
          <label style={lbl}>Зарах үнэ ₮</label>
          <input style={inputSt} value={price} onChange={(e: any) => setPrice(e.target.value)} type="number" min="0" step="1" />
        </div>
        <div>
          <label style={lbl}>Хуучин үнэ ₮</label>
          <input style={inputSt} value={op} onChange={(e: any) => setOp(e.target.value)} type="number" min="0" step="1" />
        </div>
        <div>
          <label style={lbl}>Badge</label>
          <select style={inputSt} value={badge} onChange={(e: any) => setBadge(e.target.value)}>
            <option>Хэлтэй</option>
            <option>Хадмал</option>
          </select>
        </div>
        <div>
          <label style={lbl}>Категори</label>
          <select style={inputSt} value={category} onChange={(e: any) => setCategory(e.target.value)}>
            
            <option>Эротик</option>
            <option>Гадаад</option>
            <option>Хятад</option>
            <option>Орос</option>
          </select>
        </div>
      </div>
      <label style={{ ...lbl, marginTop: 8 }}>Видео URL</label>
      <input style={inputSt} value={url} onChange={(e: any) => setUrl(e.target.value)} placeholder="https://iframe.mediadelivery.net/..." />
      <TrailerEditor ref={trailerEditorRef} filmId={f.id} videoUrl={url} value={previewUrl} onChange={setPreviewUrl} onBusyChange={setTrailerBusy} disabled={saving || uploading || trailerBusy} />
      <PosterUpload value={img} onChange={setImg} onBusyChange={setUploading} disabled={saving || uploading || trailerBusy} />
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={save} disabled={saving || uploading || trailerBusy} style={{ flex: 1, background: C.gold, border: "none", borderRadius: 8, padding: "10px", fontWeight: 700, cursor: "pointer", color: "#000", opacity: saving ? 0.6 : 1 }}>
          {saving ? "..." : "✅ Хадгалах"}
        </button>
        <button disabled={saving || uploading || trailerBusy} onClick={onDone} style={{ flex: 1, background: C.card2, border: `0.5px solid ${C.bd}`, borderRadius: 8, padding: "10px", color: C.muted, fontSize: 13, cursor: "pointer" }}>Болих</button>
      </div>
    </fieldset>
  );
}

// ══════════════════════════════════════════════
// ADMIN ТОХИРГОО — Messenger URL
// ══════════════════════════════════════════════
function AdminSettingsTab() {
  const [messengerUrl,setMessengerUrl]=useState("");
  const [bankName,setBankName]=useState(DEFAULT_BANK_ACCOUNT.bank);
  const [bankAccount,setBankAccount]=useState(DEFAULT_BANK_ACCOUNT.number);
  const [accountName,setAccountName]=useState(DEFAULT_BANK_ACCOUNT.name);
  const [bankIban,setBankIban]=useState(DEFAULT_BANK_ACCOUNT.iban);
  const [saved,setSaved]=useState(false);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const saveBusy=useRef(false);
  useEffect(()=>{
    let active=true;
    requestJson("/api/settings").then(data=>{
      if(!active)return;
      setMessengerUrl(data?.messengerUrl||"");
      setBankName(data?.bankName||DEFAULT_BANK_ACCOUNT.bank);
      setBankAccount(data?.bankAccount||DEFAULT_BANK_ACCOUNT.number);
      setAccountName(data?.accountName||DEFAULT_BANK_ACCOUNT.name);
      setBankIban(data?.bankIban||DEFAULT_BANK_ACCOUNT.iban);
    }).catch(()=>{}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[]);
  const saveSettings=async()=>{
    if(saveBusy.current)return;
    const messenger=messengerUrl.trim();
    const bank=bankName.trim();
    const number=bankAccount.trim();
    const owner=accountName.trim();
    const iban=bankIban.toUpperCase().replace(/\s+/g,"");
    if(messenger&&!safeUrl(messenger)){alert("Зөв HTTPS Messenger холбоос оруулна уу.");return;}
    if(bank.length<2){alert("Банкны нэрийг оруулна уу.");return;}
    if(!/^[A-Za-z0-9 -]{6,40}$/.test(number)){alert("Дансны дугаараа зөв оруулна уу.");return;}
    if(owner.length<2){alert("Данс эзэмшигчийн нэрийг оруулна уу.");return;}
    if(iban&&!/^MN\d{1,8}$/.test(iban)){alert("IBAN нь MN-ээр эхэлсэн, нийт 10 хүртэл тэмдэгт байна. 10-аас богино байж болно.");return;}
    saveBusy.current=true;setSaving(true);setSaved(false);
    try{
      const data=await requestJson("/api/settings",{method:"PUT",body:JSON.stringify({messengerUrl:messenger,bankName:bank,bankAccount:number,accountName:owner,bankIban:iban})});
      setMessengerUrl(data?.messengerUrl||"");setBankName(data.bankName);setBankAccount(data.bankAccount);setAccountName(data.accountName);setBankIban(data.bankIban||DEFAULT_BANK_ACCOUNT.iban);
      setSaved(true);window.dispatchEvent(new Event("kinoSettingsChanged"));
    }catch{}finally{saveBusy.current=false;setSaving(false);}
  };
  if(loading)return <div style={{textAlign:"center",padding:40,color:C.muted}}>Ачааллаж байна...</div>;
  return <div style={{padding:"0 14px"}}>
    <ReadinessCheck />
    <div style={{background:C.card,border:`0.5px solid ${C.bd}`,borderRadius:12,padding:16,marginBottom:12}}>
      <div style={{fontSize:14,fontWeight:700,color:C.txt,marginBottom:16}}>⚙️ Сайтын тохиргоо</div>
      <label style={lbl}>🏦 Банкны нэр</label>
      <input value={bankName} maxLength={80} onChange={(e:any)=>setBankName(e.target.value)} placeholder="Хаан банк" style={{...inputSt,marginBottom:12}}/>
      <label style={lbl}>👤 Данс эзэмшигчийн нэр</label>
      <input value={accountName} maxLength={100} onChange={(e:any)=>setAccountName(e.target.value)} placeholder="Данс эзэмшигч" style={{...inputSt,marginBottom:12}}/>
      <label style={lbl}>💳 Дансны дугаар</label>
      <input value={bankAccount} maxLength={40} autoComplete="off" onChange={(e:any)=>setBankAccount(e.target.value.replace(/[^A-Za-z0-9 -]/g,""))} placeholder="5403972086" style={{...inputSt,marginBottom:12,fontFamily:"monospace",fontSize:17}}/>
      <label style={lbl}>🏷️ IBAN дансны дугаар</label>
      <input value={bankIban} maxLength={10} autoComplete="off" onChange={(e:any)=>setBankIban(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,10))} placeholder="MN03000500" style={{...inputSt,marginBottom:12,fontFamily:"monospace",fontSize:15}}/>
      <div style={{fontSize:11,color:C.muted,marginTop:-7,marginBottom:12}}>IBAN: MN-ээр эхэлсэн, нийт 10 хүртэл тэмдэгт. 10-аас богино байж болно.</div>
      <div style={{background:C.card2,border:`0.5px solid ${C.bd}`,borderRadius:10,padding:"10px 12px",marginBottom:16}}>
        <div style={{fontSize:11,color:C.muted,marginBottom:4}}>Хэрэглэгчид ингэж харагдана</div><div style={{fontSize:13,color:C.txt}}>{bankName||"—"} · {accountName||"—"}</div><div style={{fontSize:12,color:C.muted,marginTop:4}}>IBAN {bankIban||"—"}</div><strong style={{display:"block",fontSize:18,color:C.gold,marginTop:3}}>{bankAccount||"—"}</strong>
      </div>
      <label style={lbl}>💬 Messenger холбоос</label>
      <div style={{fontSize:11,color:C.muted,marginBottom:8}}>Жишээ: https://m.me/таны_хуудас_нэр</div>
      <input value={messengerUrl} onChange={(e:any)=>setMessengerUrl(e.target.value)} placeholder="https://m.me/..." style={{...inputSt,marginBottom:12}}/>
      <button onClick={saveSettings} disabled={saving} style={{...goldBtn,borderRadius:10}}>{saving?"Хадгалж байна…":saved?"✅ Хадгалагдлаа!":"💾 Бүгдийг хадгалах"}</button>
    </div>
    <div style={{background:C.card2,border:`0.5px solid ${C.bd}`,borderRadius:10,padding:"10px 14px"}}><div style={{fontSize:12,color:C.muted,lineHeight:1.7}}>Дансны нэр, дугаар хадгалмагц дараагийн төлбөрийн цонхонд шинэ мэдээлэл шууд ашиглагдана.</div></div>
  </div>;
}

function AdminAnalyticsTab() {
  const [days,setDays]=useState(30);
  const [data,setData]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  const [resetting,setResetting]=useState(false);
  const load=useCallback(async()=>{
    setLoading(true);
    try{setData(await requestJson(`/api/analytics?days=${days}`,{},true));}
    catch{setData(null);}
    finally{setLoading(false);}
  },[days]);
  useEffect(()=>{void load();},[load]);

  const reset=async()=>{
    if(!window.confirm("Статистикийг одооноос 0-оос шинээр эхлүүлэх үү? Хуучин raw түүх устахгүй."))return;
    setResetting(true);
    try{await requestJson("/api/analytics",{method:"POST",body:JSON.stringify({action:"reset"})});await load();}
    finally{setResetting(false);}
  };

  const today=data?.today||{};
  const period=data?.period||{};
  const topFilms=Array.isArray(data?.topFilms)?data.topFilms:[];
  const daily=Array.isArray(data?.daily)?data.daily.slice(-7):[];
  const stat=(label:string,value:any,note?:string,suffix="")=><div style={{background:C.card,border:`0.5px solid ${C.bd}`,borderRadius:10,padding:"12px 10px"}}>
    <div style={{fontSize:10,color:C.muted,lineHeight:1.35}}>{label}</div>
    <div style={{fontSize:21,fontWeight:900,color:C.gold,marginTop:3}}>{Number(value||0).toLocaleString()}{suffix}</div>
    {note&&<div style={{fontSize:9,color:C.muted,marginTop:2,lineHeight:1.35}}>{note}</div>}
  </div>;

  return <div style={{padding:"0 14px"}}>
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,flexWrap:"wrap"}}>
      <div style={{fontSize:15,fontWeight:800,color:C.txt}}>📊 Сайтын статистик</div>
      <button type="button" onClick={load} disabled={loading||resetting} style={{marginLeft:"auto",background:C.card2,border:`0.5px solid ${C.bd}`,borderRadius:8,padding:"7px 10px",color:C.muted,fontSize:12}}>{loading?"…":"🔄 Шинэчлэх"}</button>
      <button type="button" onClick={()=>void reset()} disabled={loading||resetting} style={{background:"#301416",border:"1px solid #7f1d1d",borderRadius:8,padding:"7px 10px",color:"#fecaca",fontSize:12,fontWeight:750}}>{resetting?"Эхлүүлж байна…":"↺ 0-оос шинээр эхлүүлэх"}</button>
    </div>
    {data?.resetAt&&<div style={{fontSize:10,color:C.muted,marginBottom:14}}>Статистикийн эхлэл: {new Date(data.resetAt).toLocaleString("mn-MN",{timeZone:"Asia/Ulaanbaatar"})}</div>}

    <div style={{fontSize:12,fontWeight:800,color:C.txt,marginBottom:8}}>Өнөөдөр</div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8,marginBottom:16}}>
      {stat("Давтагдашгүй browser",today.uniqueVisitors,"Cookie-аар давхардлыг хасна")}
      {stat("Шинэ browser #",today.newBrowsers)}
      {stat("Сайт бүрэн ачаалсан",today.visits,"Session + киноны жагсаалт бэлэн болсон оролт")}
      {stat("Кино нээсэн",today.filmOpens)}
      {stat("Киног бүтэн үзэх дарсан",today.watchClicks,`${Number(today.uniqueWatchers||0)} өөр browser`)}
      {stat("Төлбөрийн хэсэг рүү орсон",today.paymentOpens,`${Number(today.uniquePaymentVisitors||0)} өөр browser`)}
      {stat("Кино тоглож эхэлсэн",today.playStarts,`${Number(today.uniquePlayers||0)} өөр browser`)}
      {stat("Facebook / Messenger-ээс",today.facebookVisits)}
      {stat("Банкны цэнэглэлт",today.topupAmount,`${Number(today.topupCount||0)} амжилттай цэнэглэлт`,"₮")}
    </div>

    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
      <div style={{fontSize:12,fontWeight:800,color:C.txt}}>Хугацааны нийлбэр</div>
      <select value={days} onChange={e=>setDays(Number(e.target.value))} style={{...inputSt,marginLeft:"auto",width:"auto",padding:"7px 10px",fontSize:12}}>
        <option value={7}>7 хоног</option><option value={30}>30 хоног</option><option value={90}>90 хоног</option><option value={365}>365 хоног</option>
      </select>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:7,marginBottom:18}}>
      {stat("Давтагдашгүй browser",period.uniqueVisitors)}
      {stat("Шинээр үүссэн browser #",period.newBrowsers)}
      {stat("Мөнгө хийсэн хэрэглэгч",period.payingUsers)}
      {stat("Идэвхтэй эрхтэй",period.activeRightsUsers)}
      {stat("Банкны цэнэглэлт",period.topupAmount,`${Number(period.topupCount||0)} удаа`,"₮")}
      {stat("Дундаж цэнэглэлт",period.avgTopupAmount,undefined,"₮")}
      {stat("Админы нэмсэн мөнгө",period.adminCreditAmount,"Борлуулалтын орлогод орохгүй","₮")}
      {stat("Wallet-аас зарцуулсан",period.spentAmount,undefined,"₮")}
      {stat("Нийт wallet үлдэгдэл",period.walletBalanceOutstanding,"Бүх хэрэглэгчийн одоогийн нийлбэр","₮")}
      {stat("1 кино авсан",period.filmPurchases)}
      {stat("Багц авсан",period.packagePurchases)}
      {stat("Идэвхтэй pending",period.pendingTopups,"Хэрэглэгч+дүнгээр давхардлыг хассан")}
      {stat("Push идэвхжүүлсэн",period.pushEnabledUsers)}
      {stat("SMS автоматаар баталсан",period.autoSmsConfirmed)}
      {stat("SMS алдаа",period.smsFailures)}
      {stat("Төлбөрийн хэсэг рүү орсон",period.paymentOpens,`${Number(period.uniquePaymentVisitors||0)} өөр browser`)}
      {stat("Unique browser → Үзэх",period.visitorToWatchPct,undefined,"%")}
      {stat("Үзэх → Төлбөрийн хэсэг",period.watchToPaymentPct,undefined,"%")}
      {stat("Төлбөрийн хэсэг → Тоглосон",period.paymentToPlayPct,undefined,"%")}
      {stat("Unique Үзэх → Тоглосон",period.watchToPlayPct,undefined,"%")}
    </div>

    {daily.length>0&&<><div style={{fontSize:12,fontWeight:800,color:C.txt,marginBottom:8}}>Сүүлийн өдрүүд</div>
      <div style={{display:"grid",gap:6,marginBottom:18}}>{daily.map((row:any)=><div key={row.day_date} style={{display:"grid",gridTemplateColumns:"1.2fr repeat(4,1fr)",gap:6,padding:"8px 9px",background:C.card,border:`0.5px solid ${C.bd}`,borderRadius:8,fontSize:10,color:C.muted}}>
        <strong style={{color:C.txt}}>{new Date(row.day_date+"T00:00:00").toLocaleDateString("mn-MN",{month:"2-digit",day:"2-digit"})}</strong>
        <span>👤 {Number(row.visitors||0)}</span><span>▶ {Number(row.watch_clicks||0)}</span><span>🎬 {Number(row.play_starts||0)}</span><span>💰 {Number(row.topup_amount||0).toLocaleString()}₮</span>
      </div>)}</div></>}

    <div style={{fontSize:12,fontWeight:800,color:C.txt,marginBottom:8}}>Хамгийн их сонирхсон / тоглосон кино</div>
    {loading&&!data?<div style={{padding:30,textAlign:"center",color:C.muted}}>Ачааллаж байна…</div>
      : topFilms.length===0?<div style={{padding:20,textAlign:"center",color:C.muted,background:C.card,borderRadius:10}}>Одоогоор статистик цуглараагүй байна.</div>
      : <div style={{display:"flex",flexDirection:"column",gap:7}}>
        {topFilms.map((row:any,index:number)=><div key={row.film_id} style={{display:"grid",gridTemplateColumns:"28px minmax(0,1fr) auto",alignItems:"center",gap:8,background:C.card,border:`0.5px solid ${C.bd}`,borderRadius:10,padding:"9px 10px"}}>
          <div style={{fontSize:12,fontWeight:900,color:C.gold}}>#{index+1}</div>
          <div style={{minWidth:0}}><div style={{fontSize:12,fontWeight:750,color:C.txt,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{row.title}</div><div style={{fontSize:9,color:C.muted,marginTop:2}}>Нээсэн {Number(row.opens||0).toLocaleString()} · Үзэх {Number(row.watch_clicks||0).toLocaleString()}</div></div>
          <div style={{textAlign:"right"}}><div style={{fontSize:15,fontWeight:900,color:C.green}}>{Number(row.play_starts||0).toLocaleString()}</div><div style={{fontSize:9,color:C.muted}}>Тоглосон</div></div>
        </div>)}
      </div>}
  </div>;
}

function AppearancePreview({films}: {films:any[]}) {
  const [catalogState,setCatalogState]=useState<CatalogState>({...INITIAL_CATALOG});
  const noop=()=>{};
  return <HomePage preview films={films} catalogState={catalogState} onCatalogChange={setCatalogState} loading={false} user={null} chatUnread={0} onFilm={noop} onAdmin={noop} onContact={noop} onOpenLogin={noop} onMonthly={noop} onRetry={noop}/>;
}

function AdminPage({ films, onBack, onRefresh, onAppearanceSaved }: any) {
  const [tab, setTab] = useState<"list" | "add" | "sms" | "orders" | "members" | "analytics" | "settings" | "appearance">("list");
  const [editId, setEditId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const savingRef = useRef(false);
  const unreadCount = useChatUnread("admin");
  const [imgVal, setImgVal] = useState(""); const [urlVal, setUrlVal] = useState("");

  const empty = { title: "", description: "", views: 0, op: 6000, price: 2000, badge: "Хэлтэй", free: false, locked: true, url: "", img: "", bg: "#1a0820", cat: "Гадаад" };
  const [form, setForm] = useState<any>(empty);
  const set = (k: string) => (e: any) => setForm((f: any) => ({ ...f, [k]: e.target.value }));
  const setChk = (k: string) => (e: any) => setForm((f: any) => ({ ...f, [k]: e.target.checked }));
  const save = async () => {
    if (savingRef.current || uploading) return;
    if (!form.title.trim()) { alert("Гарчиг оруулна уу"); return; }
    savingRef.current=true;setSaving(true);
    try {
      const payload: any = {
        title: form.title.trim(),
        views: Number(form.views),
        op: Number(form.op),
        price: Number(form.price),
        badge: encodeBadgeCat(form.badge || "Хэлтэй", form.cat || "Эротик"),
        free: !!form.free,
        locked: form.free ? false : form.locked !== false,
        url: form.url || "",
        img: form.img || "",
        bg: form.bg || "#1a0820",
      };
      if (form.preview_url) payload.preview_url = form.preview_url;
      if (form.description?.trim()) payload.description = form.description.trim();
      const res = await dbFetch("films", { method: "POST", body: JSON.stringify(payload) });
      if (!Array.isArray(res) || res.length === 0) {
        alert("Алдаа: " + (res?.message || "Өөрчлөлт баталгаажаагүй."));
        return;
      }

      setForm(empty); setTab("list"); onRefresh();
    } catch(e: any) {
      alert("Алдаа гарлаа: " + (e?.message || "Дахин оролдоно уу"));
    } finally {
      savingRef.current=false;setSaving(false);
    }
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

  if(tab === "appearance")return <AppearanceEditor onClose={()=>setTab("list")} onSaved={onAppearanceSaved}><AppearancePreview films={films}/></AppearanceEditor>;
  return (
    <div className="admin-surface" style={{ background: C.bg, minHeight: "100vh", paddingBottom: 30 }}>
      <div style={{ background: C.card, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `0.5px solid ${C.bd}`, position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: C.muted, fontSize: 22, cursor: "pointer" }}>←</button>
          <span style={{ fontSize: 15, fontWeight: 700, color: C.txt }}>Кино удирдах</span>
        </div>
        <span style={{ fontSize: 12, color: C.muted }}>{films.length} кино</span>
      </div>
      <div className="admin-tabs" style={{ display: "flex", flexWrap: "wrap", padding: "10px 14px", gap: 6 }}>
        <button onClick={() => setTab("list")} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: tab === "list" ? C.gold : C.card2, color: tab === "list" ? "#000" : C.muted, fontWeight: 700, cursor: "pointer", fontSize: 11 }}>📋 Жагсаалт</button>
        <button onClick={() => setTab("orders")} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: tab === "orders" ? C.gold : C.card2, color: tab === "orders" ? "#000" : C.muted, fontWeight: 700, cursor: "pointer", fontSize: 11 }}>🧾 Захиалга</button>
        <button onClick={() => setTab("members")} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: tab === "members" ? C.gold : C.card2, color: tab === "members" ? "#000" : C.muted, fontWeight: 700, cursor: "pointer", fontSize: 11 }}>👥 Гишүүд</button>
        <button onClick={() => setTab("analytics")} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: tab === "analytics" ? C.gold : C.card2, color: tab === "analytics" ? "#000" : C.muted, fontWeight: 700, cursor: "pointer", fontSize: 11 }}>📊 Статистик</button>
        <button onClick={() => setTab("add")} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: tab === "add" ? C.gold : C.card2, color: tab === "add" ? "#000" : C.muted, fontWeight: 700, cursor: "pointer", fontSize: 11 }}>➕ Нэмэх</button>
        <button onClick={() => { setTab("sms"); window.dispatchEvent(new Event("kinoChatChanged")); }} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: tab === "sms" ? C.gold : C.card2, color: tab === "sms" ? "#000" : C.muted, fontWeight: 700, cursor: "pointer", fontSize: 11, position: "relative" }}>
          💬 Холбогдох
          {unreadCount > 0 && tab !== "sms" && (
            <span style={{ position: "absolute", top: 4, right: 4, background: C.red, color: "#fff", borderRadius: "50%", width: 18, height: 18, fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{unreadCount}</span>
          )}
        </button>
        <button onClick={() => setTab("settings")} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: tab === "settings" ? C.gold : C.card2, color: tab === "settings" ? "#000" : C.muted, fontWeight: 700, cursor: "pointer", fontSize: 11 }}>⚙️ Тохиргоо</button>
        <button type="button" onClick={() => setTab("appearance")} style={{ flex: 1, padding: "10px", borderRadius: 8, border: `1px solid ${C.bd}`, background: C.card2, color: C.txt, fontWeight: 700, cursor: "pointer", fontSize: 11 }}>◫ Загвар өөрчлөх</button>
      </div>

      {tab === "orders" && <AdminOrdersTab />}
      {tab === "settings" && <AdminSettingsTab />}
      {tab === "members" && <AdminMembersTab />}
      {tab === "analytics" && <AdminAnalyticsTab />}
      {tab === "sms" && <AdminChatInbox announcements={<AdminAnnouncements />} />}

      {tab === "add" && (
        <div style={{ padding: "0 14px" }}>
          <div style={{ background: C.card, border: `0.5px solid ${C.bd}`, borderRadius: 12, padding: 16 }}>
            <label style={lbl}>Гарчиг *</label>
            <input style={inputSt} value={form.title} onChange={set("title")} placeholder="Кино нэр" />
            <label style={{...lbl,marginTop:10}} htmlFor="new-film-description">Киноны тайлбар</label>
            <textarea id="new-film-description" style={inputSt} rows={5} maxLength={4000} value={form.description} onChange={set("description")} placeholder="Киноны үйл явдлыг товч танилцуулаарай." />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
              <div><label style={lbl}>Үзсэн тоо</label><input style={inputSt} value={form.views} onChange={set("views")} type="number" min="0" step="1" /></div>
              <div><label style={lbl}>Badge</label>
                <select style={inputSt} value={form.badge} onChange={set("badge")}><option>Хэлтэй</option><option>Хадмал</option></select>
              </div>
              <div><label style={lbl}>Категори</label>
                <select style={inputSt} value={form.cat || "Гадаад"} onChange={set("cat")}>
                  <option>Эротик</option>
                  <option>Гадаад</option>
                  <option>Хятад</option>
                  <option>Орос</option>
                </select>
              </div>
              <div><label style={lbl}>Хуучин үнэ ₮</label><input style={inputSt} value={form.op} onChange={set("op")} type="number" min="0" step="1" /></div>
              <div><label style={lbl}>Зарах үнэ ₮</label><input style={inputSt} value={form.price} onChange={set("price")} type="number" min="0" step="1" /></div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, padding: "10px", background: C.card2, borderRadius: 8 }}>
              <input type="checkbox" id="cb-free" checked={form.free} onChange={setChk("free")} style={{ width: 18, height: 18 }} />
              <label htmlFor="cb-free" style={{ fontSize: 14, color: C.txt, cursor: "pointer" }}>🆓 Үнэгүй кино</label>
            </div>
            <label style={{ ...lbl, marginTop: 12 }}>Видео URL (YouTube / MP4 / Google Drive)</label>
            <input style={inputSt} value={form.url} onChange={set("url")} placeholder="https://youtu.be/... эсвэл .mp4 холбоос" />
            <label style={{ ...lbl, marginTop: 10 }}>Трейлерийн холбоос (богино хэсэг)</label>
            <input style={inputSt} value={form.preview_url || ""} onChange={set("preview_url")} placeholder="https://your.b-cdn.net/preview.mp4" />
            <PosterUpload value={form.img || ""} onChange={img=>setForm((current:any)=>({...current,img}))} onBusyChange={setUploading} disabled={saving || uploading} />
            <button onClick={save} disabled={saving || uploading} style={{ ...goldBtn, marginTop: 16, opacity: saving ? 0.6 : 1 }}>
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
                  {f.img ? <img loading="lazy" decoding="async" src={f.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 20 }}>🎬</span>}
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
              <CopyFilmLink id={f.id} title={f.title} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const {appearance,apply:applyAppearance}=useSiteAppearance();
  const [appError,setAppError]=useState("");
  useEffect(()=>{
    const show=(event:Event)=>setAppError(String((event as CustomEvent).detail||"Алдаа гарлаа."));
    const rejection=(event:PromiseRejectionEvent)=>{setAppError(event.reason instanceof Error?event.reason.message:"Үйлдэл амжилтгүй.");event.preventDefault();};
    window.addEventListener("kinoError",show);window.addEventListener("unhandledrejection",rejection);
    return()=>{window.removeEventListener("kinoError",show);window.removeEventListener("unhandledrejection",rejection);};
  },[]);
  const [page, setPage] = useState("home");
  const [films, setFilms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [payFilm, setPayFilm] = useState<any>(null);
  const [curFilm, setCurFilm] = useState<any>(null);
  const [adminAuth, setAdminAuth] = useState(false);
  const [loadError, setLoadError] = useState("");
  const filmLoadRequest=useRef(0);
  const filmLoadController = useRef<AbortController | null>(null);
  const [catalogState, setCatalogState] = useState<CatalogState>({...INITIAL_CATALOG});
  const playRequest = useRef(0);
  const [filmTarget, setFilmTarget] = useState<FilmDestination>({kind: "none"});
  const [selectedFilm, setSelectedFilm] = useState<any>(null);
  const [filmOpening, setFilmOpening] = useState(false);
  const [filmError, setFilmError] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const [watching, setWatching] = useState(false);
  const [watchError, setWatchError] = useState("");
  const pendingActionRef = useRef<{kind:"watch";film:FilmDetails} | {kind:"plan";plan:string;film:FilmDetails|null} | null>(null);
  const [showContact, setShowContact] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [user, setUser] = useState<any>(null);
  const chatUnread = useChatUnread(user?.id || null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [mounted, setMounted] = useState(false);
  const visitTracked = useRef(false);
  useEffect(() => {
    setMounted(true);
    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    const scrollTop = () => window.scrollTo({top:0,left:0,behavior:"auto"});
    scrollTop();
    const firstFrame = window.requestAnimationFrame(() => {
      scrollTop();
      window.requestAnimationFrame(scrollTop);
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);
  const [accessMap, setAccessMap] = useState<Record<string, number>>({});
  const [walletBalance, setWalletBalance] = useState(0);
  useEffect(() => {
    document.documentElement.dataset.tazaWalletBalance = String(walletBalance);
    window.dispatchEvent(new CustomEvent("tazaWalletBalanceChanged",{detail:walletBalance}));
  }, [walletBalance]);
  const accessOwner = useRef<number | null>(null);
  const deviceRequest = useRef<Promise<any> | null>(null);

  // DB-с confirmed төлбөрүүдийг татаж access олгох
  const syncAccessFromDB = async (userId: number) => {
    const data=await requestJson("/api/access",{},true);
    if(accessOwner.current===userId)setAccessMap(data.access || {});
  };
  const syncWalletFromDB = async (userId: number) => {
    const data=await requestJson("/api/wallet",{},true);
    const balance=Number(data?.balance || 0);
    if(accessOwner.current===userId && Number.isSafeInteger(balance) && balance>=0)setWalletBalance(balance);
    return balance;
  };

  const ensureDeviceUser = async () => {
    if(user?.id)return user;
    if(adminAuth)return null;
    if(deviceRequest.current)return deviceRequest.current;
    const pending=requestJson("/api/device",{method:"POST",body:"{}"},true).then(async data=>{
      if(!data?.user?.id)throw new Error("Төхөөрөмжийг таньж чадсангүй. Дахин оролдоно уу.");
      accessOwner.current=data.user.id;setUser(data.user);
      try{await Promise.all([syncAccessFromDB(data.user.id),syncWalletFromDB(data.user.id)]);}catch{}
      return data.user;
    });
    deviceRequest.current=pending;
    try{return await pending;}finally{if(deviceRequest.current===pending)deviceRequest.current=null;}
  };

  useEffect(() => {
    let active=true;
    try { localStorage.removeItem("kino_session");localStorage.removeItem("kino_access"); } catch {}
    requestJson("/api/auth", {}, true).then(data=>{
      if(!active)return;
      if(data?.admin){setAdminAuth(true);}
      else if(data?.user){accessOwner.current=data.user.id;setUser(data.user);void Promise.all([syncAccessFromDB(data.user.id),syncWalletFromDB(data.user.id)]).catch(()=>{});}
    }).catch(()=>{}).finally(()=>{if(active)setAuthReady(true);});
    return()=>{active=false;};
  }, []);

  useEffect(()=>{
    if(!mounted||!authReady||!user?.id)return;
    const url=new URL(window.location.href);
    if(url.searchParams.get("chat")!=="1")return;
    url.searchParams.delete("chat");
    window.history.replaceState(window.history.state,"",url.pathname+(url.search?"?"+url.searchParams.toString():"")+url.hash);
    setShowContact(true);
  },[mounted,authReady,user?.id]);

  // Refresh on return from a banking app; do not poll hidden tabs.
  useEffect(() => {
    if (!user?.id) return;
    let busy=false, cancelled=false;
    const refresh=async()=>{
      if(busy || cancelled || document.hidden)return;
      busy=true;
      try { await Promise.all([syncAccessFromDB(user.id),syncWalletFromDB(user.id)]); } catch {} finally {busy=false;}
    };
    window.addEventListener("focus",refresh);
    window.addEventListener("online",refresh);
    window.addEventListener("kinoAccessChanged",refresh);
    document.addEventListener("visibilitychange",refresh);
    const timer=setInterval(refresh,30000);
    return()=>{cancelled=true;clearInterval(timer);window.removeEventListener("focus",refresh);window.removeEventListener("online",refresh);window.removeEventListener("kinoAccessChanged",refresh);document.removeEventListener("visibilitychange",refresh);};
  },[user?.id]);

  const hasAccess = (filmId: number, category?: string): boolean => {
    if (!user) return false;
    const now = Date.now();
    if (accessMap["monthly"] && accessMap["monthly"] > now) return true;
    if (accessMap[`film_${filmId}`] && accessMap[`film_${filmId}`] > now) return true;
    const catMap: any = { "Эротик": "cat_erotic", "Гадаад": "cat_gadaad", "Хятад": "cat_hyatad", "Орос": "cat_oros" };
    if (category && catMap[category] && accessMap[catMap[category]] && accessMap[catMap[category]] > now) return true;
    return false;
  };

  const loadFilms = useCallback(async () => {
    filmLoadController.current?.abort();
    const controller = new AbortController();
    filmLoadController.current = controller;
    const request=++filmLoadRequest.current;
    setLoading(true);setLoadError("");
    try {
      const data = await dbAll("films?select=*", {signal: controller.signal}, true);
      if(request!==filmLoadRequest.current || controller.signal.aborted)return;
      setFilms(Array.isArray(data) ? data : []);
    } catch(e) {
      if(request!==filmLoadRequest.current || controller.signal.aborted)return;
      setLoadError(e instanceof Error ? e.message : "Холболтоо шалгаад дахин оролдоно уу.");
    } finally {
      if(request===filmLoadRequest.current && !controller.signal.aborted)setLoading(false);
    }
  }, []);
  useEffect(() => { void loadFilms(); return () => filmLoadController.current?.abort(); }, [loadFilms]);
  useEffect(() => {
    if(!mounted || !authReady || loading || loadError || adminAuth || visitTracked.current)return;
    visitTracked.current=true;
    trackSiteEvent("visit");
  },[mounted,authReady,loading,loadError,adminAuth]);
  useEffect(() => {
    const retry = () => { if (loadError) void loadFilms(); };
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [loadError, loadFilms]);

  // ── Навигацийн helper ──
  const navigateTo = (newPage: string) => {
    playRequest.current++;
    pendingActionRef.current=null;setWatching(false);setWatchError("");
    setFilmTarget({kind:"none"});setSelectedFilm(null);setCurFilm(null);setPayFilm(null);
    const homeUrl = filmNavigationUrl(window.location.href, null);
    if (newPage === "home") window.history.replaceState({page: "home"}, "", homeUrl);
    else window.history.pushState({page: newPage}, "", homeUrl);
    setPage(newPage);
    if (newPage === "home") window.scrollTo?.({top:0,behavior:"instant"});
  };

  // ── Браузерийн буцах товч ──
  const pageRef = useRef("home");
  useEffect(() => { pageRef.current = page; }, [page]);

  useEffect(() => {
    const readLocation = (event?: PopStateEvent) => {
      playRequest.current++;
      pendingActionRef.current=null;setWatching(false);setWatchError("");
      setShowContact(false);setShowLoginModal(false);setShowPlanModal(false);
      setCurFilm(null);setPayFilm(null);setSelectedFilm(null);setFilmError("");
      const target=readFilmDestination(window.location.search);
      setFilmTarget(target);
      if(target.kind!=="none"){setFilmOpening(true);setPage("film");return;}
      if(event && pageRef.current==="admin"){window.dispatchEvent(new CustomEvent("adminBackPress"));return;}
      setPage("home");
    };
    prepareFilmHistory(window.history, window.location.href);
    readLocation();
    window.addEventListener("popstate", readLocation);
    return () => {playRequest.current++;window.removeEventListener("popstate", readLocation);};
  }, []);

  // Visiting a movie link loads public details only. Playback always needs a click.
  useEffect(() => {
    if(filmTarget.kind==="none")return;
    setPage("film");setFilmError("");setFilmOpening(true);
    if(filmTarget.kind==="invalid"){
      setSelectedFilm(null);setFilmError("Киноны холбоос буруу байна. Бүх кино хэсгээс киногоо сонгоно уу.");setFilmOpening(false);return;
    }
    const controller=new AbortController();
    const intent=++playRequest.current;
    const current=()=>!controller.signal.aborted && intent===playRequest.current;
    const open=async()=>{
      try {
        const rows=await dbFetch(`films?id=eq.${filmTarget.id}&limit=1`,{signal:controller.signal},true);
        if(!current())return;
        const film=Array.isArray(rows)?rows.find(row=>Number(row.id)===filmTarget.id):null;
        if(!film)throw new RequestError("Кино олдсонгүй. Холбоос хуучирсан эсвэл кино хасагдсан байж болно.",404);
        setSelectedFilm(film);
        trackSiteEvent("film_open",Number(film.id));
      } catch(error) {
        if(current())setFilmError(error instanceof Error?error.message:"Кино нээж чадсангүй. Дахин оролдоно уу.");
      } finally {if(current())setFilmOpening(false);}
    };
    void open();
    return()=>controller.abort();
  },[filmTarget]);

  const playFilm = async (f: FilmDetails, stillActive = () => true) => {
    const intent=++playRequest.current;
    let current;
    try { current=await requestJson(`/api/playback?id=${encodeURIComponent(f.id)}`,{},true); }
    catch(e){if(intent!==playRequest.current||!stillActive())return false;throw e;}
    if(intent!==playRequest.current||!stillActive())return false;
    // Details, inline payment and playback share one movie history entry.
    // Native Back reaches home; Forward restores details without autoplay.
    window.history.replaceState({page:"film",tazaFilmHome:true},"");
    trackSiteEvent("play_start",Number(f.id));
    setCurFilm(current);setPage("video");return true;
  };
  const handleFilm = (f: FilmDetails) => {
    playRequest.current++;
    pendingActionRef.current=null;setWatching(false);setWatchError("");
    setSelectedFilm(null);setCurFilm(null);setPayFilm(null);setFilmError("");setFilmOpening(true);
    const filmUrl = filmNavigationUrl(window.location.href, Number(f.id));
    const filmState = {page:"film", tazaFilmHome:true};
    if (window.history.state?.page === "film" && window.history.state?.tazaFilmHome) window.history.replaceState(filmState, "", filmUrl);
    else window.history.pushState(filmState, "", filmUrl);
    setFilmTarget({kind:"film",id:Number(f.id)});setPage("film");
    window.scrollTo?.({top:0,behavior:"instant"});
  };
  const purchaseWithWallet = async (film: FilmDetails, viewerId: number) => {
    const data=await requestJson("/api/wallet",{method:"POST",body:JSON.stringify({action:"purchase",film_id:film.id})},true);
    const balance=Number(data?.balance || 0),price=Number(data?.price || Number(film.price||0));
    if(accessOwner.current===viewerId && Number.isSafeInteger(balance) && balance>=0)setWalletBalance(balance);
    const result=String(data?.result || "");
    if(result==="purchased" || result==="owned" || result==="free"){
      await syncAccessFromDB(viewerId);
      return {ok:true,result,balance,price};
    }
    if(result==="insufficient")return {ok:false,result,balance,price};
    throw new Error("Үлдэгдлээс киноны эрх нээж чадсангүй.");
  };

  const purchasePlanWithWallet = async (plan: string, viewerId: number) => {
    const data=await requestJson("/api/wallet",{method:"POST",body:JSON.stringify({action:"purchase_plan",plan})},true);
    const balance=Number(data?.balance || 0),price=Number(data?.price || Number(PLAN_PRICES[plan]||0));
    if(accessOwner.current===viewerId && Number.isSafeInteger(balance) && balance>=0)setWalletBalance(balance);
    const result=String(data?.result || "");
    if(result==="purchased" || result==="owned"){
      await syncAccessFromDB(viewerId);
      return {ok:true,result,balance,price};
    }
    if(result==="insufficient")return {ok:false,result,balance,price};
    throw new Error("Кино сайтын дансны үлдэгдлээс багц авч чадсангүй.");
  };

  const watchFilm = async (film: FilmDetails) => {
    const startedAt=playRequest.current;
    setWatching(true);setWatchError("");
    if(adminAuth && !user){
      setWatchError("Админ горимоос кино төлбөргүй нээхийг хаасан. Хэрэглэгчийн урсгалыг шалгахын тулд админ горимоос гарна уу.");
      setWatching(false);
      return;
    }
    let viewer=user;
    try {
      if(!viewer)viewer=await ensureDeviceUser();
      if(!viewer)throw new Error("Төхөөрөмжийг таньж чадсангүй.");
      if(startedAt!==playRequest.current)return;
      const viewerId=Number(viewer.id),intent=playRequest.current+1;
      const current=()=>intent===playRequest.current && accessOwner.current===viewerId;
      try {
        if(await playFilm(film,()=>accessOwner.current===viewerId))setPayFilm(null);
      } catch(error) {
        if(!current())return;
        if(error instanceof RequestError && error.status===403){
          try{
            const wallet=await purchaseWithWallet(film,viewerId);
            if(accessOwner.current!==viewerId)return;
            if(wallet.ok){
              if(await playFilm(film,()=>accessOwner.current===viewerId))setPayFilm(null);
            }else{
              const needed=Math.max(0,wallet.price-wallet.balance);
              const topupAmount=Math.max(5000,Math.ceil(needed/1000)*1000);
              trackSiteEvent("payment_open",Number(film.id));
              setPayFilm({id:0,title:"Үлдэгдэл цэнэглэх",price:topupAmount,topupAmount,monthly:true,plan:"wallet_topup",locked:true,returnFilm:film,walletBefore:wallet.balance});
              setPage("film");
            }
          }catch(walletError){
            setWatchError(walletError instanceof Error?walletError.message:"Үлдэгдлийг шалгаж чадсангүй.");
          }
        } else setWatchError(error instanceof Error?error.message:"Кино нээж чадсангүй. Дахин оролдоно уу.");
      }
    } catch(error) {setWatchError(error instanceof Error?error.message:"Төхөөрөмжийг таньж чадсангүй. Дахин оролдоно уу.");}
    finally{setWatching(false);}
  };
  const continueFilm = () => {
    if(!selectedFilm || filmOpening || watching || !authReady)return;
    trackSiteEvent("watch_click",Number(selectedFilm.id));
    void watchFilm(selectedFilm);
  };
  const handlePaid = async (stillActive = () => true) => {
    if(!payFilm || !user || !stillActive())return;
    const owner=user.id;
    const current=()=>stillActive()&&accessOwner.current===owner;
    if(payFilm.plan==="wallet_topup"){
      await syncWalletFromDB(owner);
      if(!current())return;
      const returnPlan=typeof payFilm.returnPlan==="string"?payFilm.returnPlan:"";
      const film=payFilm.returnFilm as FilmDetails | undefined;
      if(returnPlan){
        const wallet=await purchasePlanWithWallet(returnPlan,owner);
        if(!current())return;
        if(!wallet.ok)throw new Error(`Багц авахад үлдэгдэл хүрэлцэхгүй байна. Одоогийн үлдэгдэл ${wallet.balance.toLocaleString()}₮.`);
        setPayFilm(null);
        if(film)await playFilm(film,()=>accessOwner.current===owner);
        else setPage("home");
        return;
      }
      if(!film){setPayFilm(null);setPage("home");return;}
      const wallet=await purchaseWithWallet(film,owner);
      if(!current())return;
      if(!wallet.ok)throw new Error(`Үлдэгдэл хүрэлцэхгүй байна. Одоогийн үлдэгдэл ${wallet.balance.toLocaleString()}₮.`);
      if(await playFilm(film,()=>accessOwner.current===owner))setPayFilm(null);
      return;
    }
    await syncAccessFromDB(owner);
    if(!current())return;
    const film=payFilm.returnFilm || (payFilm.monthly?null:payFilm);
    if(film){await playFilm(film,current);if(current())setPayFilm(null);}
    else{setPayFilm(null);setPage("home");}
  };

  const openPlanCheckout = (plan: string, sourceFilm: FilmDetails | null = null) => {
    if (plan === "show_plan") {
      window.history.pushState({ page: "planmodal" }, "");setShowPlanModal(true);return;
    }
    if (!Object.prototype.hasOwnProperty.call(PLAN_PRICES,plan)) return;
    if(sourceFilm && !filmPlans(sourceFilm).some(item=>item.id===plan))return;
    if(sourceFilm){setPage("film");}
    else navigateTo("payment");
    setPayFilm({id:0,title:planLabel(plan),price:PLAN_PRICES[plan],monthly:true,plan,locked:true,returnFilm:sourceFilm});
  };
  const handlePlanSelect = async (plan: string, sourceFilm: FilmDetails | null = null) => {
    try {
      let viewer=user;
      if(!viewer && !adminAuth)viewer=await ensureDeviceUser();
      if(adminAuth && !viewer){setAppError("Багц авахын тулд админ горимоос гарна уу.");return;}
      if(!viewer)throw new Error("Төхөөрөмжийг таньж чадсангүй.");
      if(!Object.prototype.hasOwnProperty.call(PLAN_PRICES,plan) || plan==="wallet_topup")return;
      if(sourceFilm && !filmPlans(sourceFilm).some(item=>item.id===plan))return;
      const viewerId=Number(viewer.id);
      const wallet=await purchasePlanWithWallet(plan,viewerId);
      if(accessOwner.current!==viewerId)return;
      if(wallet.ok){
        setPayFilm(null);
        if(sourceFilm)await playFilm(sourceFilm,()=>accessOwner.current===viewerId);
        else setPage("home");
        return;
      }
      const needed=Math.max(0,wallet.price-wallet.balance);
      const topupAmount=Math.max(5000,Math.ceil(needed/1000)*1000);
      if(sourceFilm)setPage("film");
      else navigateTo("payment");
      setPayFilm({
        id:0,title:"Үлдэгдэл цэнэглэх",price:topupAmount,topupAmount,
        monthly:true,plan:"wallet_topup",locked:true,
        returnPlan:plan,returnPrice:wallet.price,returnFilm:sourceFilm,
        walletBefore:wallet.balance
      });
    } catch(error) {setAppError(error instanceof Error?error.message:"Багц авахад алдаа гарлаа.");}
  };
  const openContact = async () => {
    try {
      if(!adminAuth && !user)await ensureDeviceUser();
      window.history.pushState({page:"contact"},"");setShowContact(true);
    } catch(error) {setAppError(error instanceof Error?error.message:"Холбогдох хэсгийг нээж чадсангүй.");}
  };
  const closeCheckout = () => {
    playRequest.current++;pendingActionRef.current=null;setWatching(false);setPayFilm(null);
    setPage(filmTarget.kind==="film"?"film":"home");
  };
  useEffect(()=>{
    if(payFilm && filmTarget.kind==="film")document.getElementById("film-payment")?.scrollIntoView?.({block:"start",behavior:window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches?"auto":"smooth"});
  },[payFilm,filmTarget.kind]);

  const handleLogin = (u: any) => {
    setAdminAuth(false);
    accessOwner.current=u.id;setUser(u);
    void Promise.all([syncAccessFromDB(u.id),syncWalletFromDB(u.id)]).catch(()=>{});setShowLoginModal(false);
    const action=pendingActionRef.current;pendingActionRef.current=null;
    if(action?.kind==="watch"){void watchFilm(action.film);return;}
    if(action?.kind==="plan"){openPlanCheckout(action.plan,action.film);return;}
    // A completed login may arrive after its dialog was closed. Preserve the
    // current destination unless the user still has an explicit pending action.
  };
  const handleLogout = async () => {
    playRequest.current++;
    try {
      await requestJson("/api/auth",{method:"POST",body:JSON.stringify({action:"logout"})});
      accessOwner.current=null;setUser(null);setAdminAuth(false);setAccessMap({});setWalletBalance(0);navigateTo("home");void loadFilms();
    } catch {} // Keep the signed-in state visible if server-side logout failed.
  };
  const filmsWithUnlock = films.map((f: any) => hasAccess(f.id, decodeCat(f.badge)) ? { ...f, locked: false } : f);

  return (
    <div className="app-shell site-theme" data-layout={appearance.layout} style={{...appearanceStyle(appearance), minHeight: "100vh", background: C.bg, fontFamily: "system-ui,sans-serif" }}>
      <ConnectionStatus />
      {appError && <div className="app-alert" role="alert"><span>{appError}</span><button onClick={()=>setAppError("")} className="icon-button" aria-label="Мэдэгдэл хаах"><UiIcon name="close" /></button></div>}


      {(page === "home" || page === "payment") && <HomePage chatUnread={chatUnread} films={filmsWithUnlock} onFilm={handleFilm} onAdmin={() => navigateTo(adminAuth ? "admin" : "adminlogin")} loading={loading} loadError={loadError} onRetry={loadFilms} user={user} onLogin={handleLogin} onLogout={handleLogout} onOpenLogin={() => setShowLoginModal(true)} onMonthly={handlePlanSelect} onContact={openContact} accessMap={accessMap} showPlan={showPlanModal} onPlanClose={() => setShowPlanModal(false)} catalogState={catalogState} onCatalogChange={setCatalogState} />}
      {page === "film" && <FilmLanding key={filmTarget.kind==="film"?filmTarget.id:"invalid"} film={selectedFilm} films={films} loading={filmOpening} error={filmError} canRetry={filmTarget.kind==="film"} watching={watching} watchError={watchError} authReady={authReady} available={!!selectedFilm && (adminAuth || selectedFilm.free || selectedFilm.locked===false || hasAccess(selectedFilm.id,decodeCat(selectedFilm.badge)))} relatedLoading={loading} relatedError={loadError} onRetryRelated={loadFilms} onFilm={handleFilm} onWatch={continueFilm} onPlan={plan=>handlePlanSelect(plan,selectedFilm)} onRetry={()=>setFilmTarget({...filmTarget})} onBack={()=>navigateTo("home")} walletBalance={walletBalance} payment={payFilm && <BankModal inline key={`${user?.id}:${payFilm.id}:${payFilm.plan || "single"}`} film={payFilm} onClose={closeCheckout} onPaid={handlePaid} user={user}/>} />}
      {page === "video" && curFilm && <VideoPage key={curFilm.id} film={curFilm} onBack={() => navigateTo("home")} />}
      {page === "adminlogin" && <AdminLogin onEnter={() => { playRequest.current++;setAdminAuth(true); accessOwner.current=null;setUser(null); setAccessMap({});setWalletBalance(0); void loadFilms(); navigateTo("admin"); }} onBack={() => setPage("home")} />}
      {page === "admin" && adminAuth && <AdminPage films={films} onBack={handleLogout} onRefresh={loadFilms} onAppearanceSaved={applyAppearance} />}
      {payFilm && page === "payment" && <BankModal key={`${user?.id}:${payFilm.id}:${payFilm.plan || "single"}`} film={payFilm} onClose={closeCheckout} onPaid={handlePaid} user={user} />}
      <PushNotificationSetup key={user?.id||"none"} enabled={!!user?.id&&!adminAuth} />
      {showContact && <ContactModal onClose={() => setShowContact(false)} user={user} onLogin={handleLogin} admin={adminAuth} onAdmin={() => {setShowContact(false);navigateTo("admin");}} />}

      {/* ── НЭВТРЭХ/БҮРТГҮҮЛЭХ — дэлгэцийн голд fixed, кино scroll-д саад болохгүй ── */}
      {showLoginModal && !user && mounted && createPortal(
        <CinemaDialog title="Нэвтрэх эсвэл бүртгүүлэх" onClose={() => {pendingActionRef.current=null;setWatching(false);setWatchError("");setShowLoginModal(false);}} className="login-dialog">
          <div className="dialog-heading"><div><span className="eyebrow">ТАЗА САЙТ</span><h2>Тавтай морил.</h2></div><button className="icon-button" onClick={()=>{pendingActionRef.current=null;setWatching(false);setWatchError("");setShowLoginModal(false);}} aria-label="Нэвтрэх цонх хаах"><UiIcon name="close"/></button></div>
          {selectedFilm && <p className="login-note">Үргэлжлүүлэх кино: <strong>{selectedFilm.title}</strong></p>}
          <p className="login-note">Утасны дугаар, PIN кодоороо нэвтэрнэ үү.</p>
          <LoginModal onLogin={(u:any)=>{handleLogin(u);setShowLoginModal(false);}}/>
        </CinemaDialog>,
        document.body
      )}
    </div>
  );
}
