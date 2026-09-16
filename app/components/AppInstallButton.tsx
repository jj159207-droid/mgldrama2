"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { installEnvironment, isStandalone, type InstallPlatform } from "@/lib/install";

type Outcome = "idle" | "prompting" | "accepted" | "dismissed" | "failed";

export default function AppInstallButton() {
  const [open, setOpen] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState(false);
  const [environment, setEnvironment] = useState<{ platform: InstallPlatform; embedded: boolean }>({ platform: "desktop", embedded: false });
  const [outcome, setOutcome] = useState<Outcome>("idle");
  const [siteUrl, setSiteUrl] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const linkRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const update = () => {
      setInstalled(isStandalone() || Boolean(window.__kinoPwa?.installed));
      setAvailable(Boolean(window.__kinoPwa?.prompt));
      setBusy(Boolean(window.__kinoPwa?.prompting));
    };
    setEnvironment(installEnvironment(navigator.userAgent, navigator.maxTouchPoints));
    setSiteUrl(window.location.origin + "/");
    update();
    const display = window.matchMedia?.("(display-mode: standalone)");
    const closeOnNavigation = () => setOpen(false);
    display?.addEventListener("change", update);
    window.addEventListener("popstate", closeOnNavigation);
    window.addEventListener("kino-install-change", update);
    window.addEventListener("pageshow", update);
    return () => {
      display?.removeEventListener("change", update);
      window.removeEventListener("popstate", closeOnNavigation);
      window.removeEventListener("kino-install-change", update);
      window.removeEventListener("pageshow", update);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      triggerRef.current?.focus();
    };
  }, [open]);

  const install = () => {
    setOpen(true);
    const state = window.__kinoPwa;
    if (isStandalone() || state?.installed || state?.prompting || !state?.prompt || environment.embedded) return;
    const prompt = state.prompt;
    // Consume once, and call synchronously while the click's user activation is live.
    state.prompt = null;
    state.prompting = true;
    window.dispatchEvent(new Event("kino-install-change"));
    setOutcome("prompting");
    const finish = () => {
      state.prompting = false;
      window.dispatchEvent(new Event("kino-install-change"));
    };
    try {
      void prompt.prompt().then(() => prompt.userChoice).then(choice => {
        setOutcome(choice.outcome);
      }).catch(() => setOutcome("failed")).finally(finish);
    } catch {
      setOutcome("failed");
      finish();
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(siteUrl);
      setCopyStatus("Холбоос хууллаа. Хөтөчдөө нээгээрэй.");
    } catch {
      linkRef.current?.focus();
      linkRef.current?.select();
      setCopyStatus("Доорх холбоосыг удаан дараад хуулна уу.");
    }
  };

  const ios = environment.platform === "ios";
  const nativeReady = available && !environment.embedded && !installed;
  const complete = () => setOpen(false);
  return <>
    <button type="button" ref={triggerRef} onClick={install} aria-busy={busy} className="app-install-trigger">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></svg>
      {installed ? "Апп суусан" : "Апп суулгах"}
    </button>
    {open && createPortal(<dialog ref={dialogRef} className="install-dialog" aria-labelledby="install-title" onCancel={event => { event.preventDefault(); complete(); }} onClick={event => { if (event.target === event.currentTarget) complete(); }}>
      <button type="button" className="install-close" aria-label="Суулгах цонх хаах" onClick={complete}>×</button>
      <img src="/icon-192.png" width="64" height="64" alt="" className="install-icon" />
      <span className="install-eyebrow">КИНО САЙТ · {ios ? "iPhone / iPad" : environment.platform === "android" ? "Android" : "Апп"}</span>
      <h2 id="install-title">{installed ? "Апп бэлэн байна" : "Кино тань нэг товчны цаана"}</h2>
      <p className="install-intro">{installed ? "Нүүр дэлгэц дээрх Кино сайт дүрсээр шууд нэвтэрнэ." : "Нүүр дэлгэцдээ нэмээд, дараагийн удаа аппын дүрсээр шууд нээгээрэй."}</p>
      {!installed && <>
        <div role="status" aria-live="polite" className="install-status">
          {outcome === "prompting" && "Нээгдсэн цонхонд «Суулгах» гэдгийг сонгоно уу."}
          {outcome === "accepted" && "Суулгах хүсэлтийг зөвшөөрлөө. Утас суулгаж дуустал түр хүлээгээд, нүүр дэлгэцээ шалгаарай."}
          {outcome === "dismissed" && "Суулгалтыг цуцаллаа. Хүссэн үедээ дахин суулгаж болно."}
          {outcome === "failed" && "Суулгах цонх нээгдсэнгүй. Доорх хөтчийн цэсээр нэмээрэй."}
        </div>
        {busy && !manual && <button type="button" className="install-help" onClick={() => setManual(true)}>Суулгах цонх харагдахгүй байна уу?</button>}
        {(!busy || manual) && outcome !== "accepted" && <>
          {environment.embedded ? <>
            <h3>Эхлээд {ios ? "Safari" : environment.platform === "android" ? "Chrome" : "үндсэн хөтөч"}-д нээгээрэй</h3>
            <ol className="install-steps"><li>Энэ цонхны <strong>⋯</strong> эсвэл <strong>⋮</strong> цэсийг дарна.</li><li><strong>{ios ? "Open in Safari" : "Open in browser"}</strong> — хөтөч дээр нээх сонголтыг сонгоно.</li><li>Сайт нээгдэхэд <strong>Апп суулгах</strong> товчийг дахин дарна.</li></ol>
            <p className="install-note">Хөтөч дээр нээх сонголт харагдахгүй бол холбоосыг хуулаад {ios ? "Safari" : "Chrome"}-д нээгээрэй.</p>
          </> : nativeReady ? <button type="button" className="install-primary" onClick={install}>Суулгах</button> : ios ? <>
            <h3>Safari дээр 3 алхам</h3>
            <ol className="install-steps"><li>Хөтчийн <strong>Хуваалцах (Share)</strong> товчийг дарна. Зарим хувилбарт эхлээд <strong>⋯</strong> цэсийг нээнэ.</li><li><strong>Add to Home Screen</strong> — Нүүр дэлгэцэнд нэмэхийг сонгоно.</li><li><strong>Open as Web App</strong> харагдвал асаагаад <strong>Add</strong> — Нэмэхийг дарна.</li></ol>
            <p className="install-note">Сонголт харагдахгүй бол Share цэсийг доош гүйлгэх эсвэл Edit Actions хэсгийг шалгаарай. Өөр хөтөч ашиглаж байгаа бол Safari-д энэ хаягийг нээнэ.</p>
          </> : environment.platform === "android" ? <>
            <h3>Chrome цэсээр суулгах</h3>
            <ol className="install-steps"><li>Chrome-ийн баруун дээд талын <strong>⋮</strong> цэсийг дарна.</li><li><strong>Install app</strong> эсвэл <strong>Add to Home screen</strong> — Нүүр дэлгэцэнд нэмэхийг сонгоно.</li><li><strong>Install</strong> — Суулгахыг баталгаажуулна.</li></ol>
            <p className="install-note">Сонголт харагдахгүй бол Chrome-д энэ хаягийг нээгээрэй. Апп өмнө нь суусан бол нүүр дэлгэц эсвэл аппын жагсаалтаа шалгана уу.</p>
          </> : <>
            <h3>Хөтчөөсөө апп болгон нэмэх</h3>
            <p className="install-note">Chrome эсвэл Edge-ийн хаягийн мөр дэх суулгах тэмдэг, эсвэл цэсний Install app / Apps сонголтыг ашиглаарай. Утсандаа суулгах бол доорх хаягийг утасныхаа хөтөч дээр нээнэ.</p>
          </>}
          {(!nativeReady || environment.embedded) && <div className="install-copy"><input ref={linkRef} aria-label="Сайтын холбоос" value={siteUrl} readOnly onFocus={event => event.target.select()} /><button type="button" onClick={copyLink}>Хуулах</button><span role="status">{copyStatus}</span></div>}
        </>}
        <p className="install-footnote">Апп суулгах нь үнэгүй. Кино үзэхэд интернэт хэрэгтэй. Төлбөртэй киноны үзэх эрх тусдаа.</p>
      </>}
      <button type="button" className="install-done" onClick={complete}>{installed ? "Үргэлжлүүлэх" : "Ойлголоо"}</button>
    </dialog>, document.body)}
  </>;
}
