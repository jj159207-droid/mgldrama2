"use client";
import {useCallback, useEffect, useRef, useState, type ReactNode} from "react";
import {requestJson, RequestError} from "@/lib/client";
import {appearanceStyle, DEFAULT_APPEARANCE, LAYOUTS, sameAppearance, TONE_GRADIENT, toneName, validAppearance, type SiteAppearance} from "@/lib/appearance";

type Props = {onClose: () => void; onSaved: (appearance: SiteAppearance) => void; children: ReactNode};
export default function AppearanceEditor({onClose,onSaved,children}: Props) {
  const [draft,setDraft] = useState<SiteAppearance>({...DEFAULT_APPEARANCE});
  const [saved,setSaved] = useState<SiteAppearance>({...DEFAULT_APPEARANCE});
  const [loading,setLoading] = useState(true), [ready,setReady] = useState(false);
  const [saving,setSaving] = useState(false), [error,setError] = useState("");
  const [message,setMessage] = useState("");
  const [conflict,setConflict] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null), busy = useRef(false), active = useRef(true);
  const loadRequest = useRef(0);
  const dirty = !sameAppearance(draft,saved);
  const load = useCallback(() => {
    const request = ++loadRequest.current;
    return requestJson("/api/appearance",{},true).then(data => {
      if (!validAppearance(data.appearance)) throw new Error("Загварын тохиргоог ачаалж чадсангүй.");
      if (!active.current || request !== loadRequest.current) return;
      setDraft(data.appearance);setSaved(data.appearance);setReady(true);setConflict(false);
    }).catch(e => {if(active.current && request === loadRequest.current)setError(e instanceof Error?e.message:"Тохиргоог ачаалж чадсангүй.");})
      .finally(() => {if(active.current && request === loadRequest.current)setLoading(false);});
  },[]);
  useEffect(() => {
    active.current=true;void load();dialog.current?.showModal();
    const previous=document.body.style.overflow;document.body.style.overflow="hidden";
    return()=>{active.current=false;document.body.style.overflow=previous;};
  },[load]);
  const close = useCallback(() => {
    if (busy.current) return;
    if (dirty && !window.confirm("Хадгалаагүй өөрчлөлтийг орхиод удирдах хэсэг рүү буцах уу?")) return;
    onClose();
  },[dirty,onClose]);
  useEffect(() => {
    const back = () => close();
    const beforeUnload = (event: BeforeUnloadEvent) => {if(dirty){event.preventDefault();event.returnValue="";}};
    window.addEventListener("adminBackPress",back);window.addEventListener("beforeunload",beforeUnload);
    return()=>{window.removeEventListener("adminBackPress",back);window.removeEventListener("beforeunload",beforeUnload);};
  },[dirty,close]);
  const change = (patch: Partial<SiteAppearance>) => {setDraft(v=>({...v,...patch}));setMessage("");setError("");};
  const save = async () => {
    if(busy.current || !ready || loading || conflict || !dirty)return;
    busy.current=true;setSaving(true);setError("");setMessage("");
    const snapshot={...draft,revision:saved.revision};
    try {
      const data=await requestJson("/api/appearance",{method:"PUT",body:JSON.stringify(snapshot)},true);
      if(!validAppearance(data.appearance) || !sameAppearance(data.appearance,snapshot) || data.appearance.revision<=snapshot.revision)throw new Error("Хадгалалтыг баталгаажуулж чадсангүй. Дахин ачаалж шалгана уу.");
      if(!active.current)return;
      setDraft(data.appearance);setSaved(data.appearance);onSaved(data.appearance);
      setMessage("Хадгалагдлаа. Шинэ загвар сайтад харагдаж байна.");
    } catch(e) {
      if(!active.current)return;
      setError(e instanceof Error?e.message:"Хадгалж чадсангүй. Дахин оролдоно уу.");
      if(e instanceof RequestError && e.status===409)setConflict(true);
    } finally {busy.current=false;if(active.current)setSaving(false);}
  };
  const disabled=loading || saving || !ready || conflict;
  return <dialog ref={dialog} className="appearance-editor" aria-labelledby="appearance-editor-title" onCancel={event=>{event.preventDefault();close();}}>
    <header className="appearance-topbar">
      <button type="button" className="appearance-back" onClick={close} disabled={saving} aria-label="Удирдах хэсэг рүү буцах">←</button>
      <div><h1 id="appearance-editor-title">Загвар өөрчлөх</h1><p>Урьдчилан харах · Хадгалах хүртэл зөвхөн танд харагдана</p></div>
      <span className={`appearance-state ${dirty?"is-dirty":""}`}>{dirty?"Хадгалаагүй":"Одоогийн загвар"}</span>
    </header>
    <section className="appearance-preview" aria-label="Сайтын загварын урьдчилсан харагдац" tabIndex={0}>
      <div className="appearance-preview-content site-theme" data-layout={draft.layout} style={appearanceStyle(draft)} inert>{children}</div>
    </section>
    <footer className="appearance-controls">
      {(error || message) && <div className={`appearance-notice ${error?"has-error":""}`} role={error?"alert":"status"}>{error || message}
        {(!ready || conflict) && !loading && <button type="button" onClick={()=>{setLoading(true);setError("");setMessage("");void load();}}>{conflict?"Шинэ тохиргоог ачаалах":"Дахин ачаалах"}</button>}
      </div>}
      <div className="appearance-sliders">
        <div className="appearance-control-row">
          <span className="appearance-control-icon" aria-hidden="true">◫</span>
          <div className="appearance-slider-group">
            <div className="appearance-label"><label htmlFor="appearance-layout">Загвар <strong>{draft.layout} · {LAYOUTS[draft.layout-1].name}</strong></label></div>
            <input id="appearance-layout" aria-label="Загвар" aria-valuetext={`${draft.layout} — ${LAYOUTS[draft.layout-1].name}`} type="range" min="1" max="4" step="1" value={draft.layout} disabled={disabled} onChange={e=>change({layout:Number(e.target.value)})}/>
            <div className="appearance-steps" aria-label="Загварын сонголтууд">{LAYOUTS.map((layout,i)=><button type="button" key={layout.name} disabled={disabled} aria-label={`Загвар ${i+1}: ${layout.name}`} aria-pressed={draft.layout===i+1} onClick={()=>change({layout:i+1})}>{i+1}<span>{layout.name}</span></button>)}</div>
          </div>
        </div>
        <div className="appearance-control-row">
          <span className="appearance-control-icon" aria-hidden="true">◐</span>
          <div className="appearance-slider-group">
            <div className="appearance-label"><label htmlFor="appearance-tone">Өнгө <strong>{toneName(draft.tone)}</strong></label><output htmlFor="appearance-tone">{draft.tone}</output></div>
            <input id="appearance-tone" className="appearance-color-range" style={{background:TONE_GRADIENT}} aria-label="Өнгө" aria-valuetext={`${toneName(draft.tone)}, ${draft.tone}`} type="range" min="0" max="100" step="1" value={draft.tone} disabled={disabled} onChange={e=>change({tone:Number(e.target.value)})}/>
          </div>
        </div>
      </div>
      <div className="appearance-save-actions"><button type="button" className="appearance-reset" disabled={disabled || !dirty} onClick={()=>{setDraft({...saved});setError("");setMessage("");}}>Өөрчлөлтийг буцаах</button><button type="button" className="appearance-save" onClick={()=>void save()} disabled={disabled || !dirty}>{saving?"Хадгалж байна…":loading?"Ачаалж байна…":"Хадгалах"}</button></div>
    </footer>
  </dialog>;
}
