import { useState, type ReactNode } from "react";
import Image from "next/image";
import { safeUrl } from "@/lib/domain";
import { filmCategory } from "@/lib/catalog";
import { filmPlans, getVideoEmbed, relatedFilms, trailerUrl, type FilmDetails } from "@/lib/film-details";

type Props = {
  film: FilmDetails | null;
  films: FilmDetails[];
  loading: boolean;
  error: string;
  canRetry: boolean;
  watching: boolean;
  watchError: string;
  authReady: boolean;
  available: boolean;
  relatedLoading: boolean;
  relatedError: string;
  payment: ReactNode;
  onWatch: () => void;
  onPlan: (plan:string) => void;
  onFilm: (film:FilmDetails) => void;
  onRetry: () => void;
  onRetryRelated: () => void;
  onBack: () => void;
};

function FilmImage({film, priority = false}: {film:FilmDetails; priority?:boolean}) {
  const [failed, setFailed] = useState(false);
  const src = safeUrl(film.img || "", true);
  // Posters are already resized by the upload service; retain their original CDN URL.
  return src && !failed ? <Image unoptimized src={src} alt={film.title} fill sizes={priority ? "(max-width: 760px) 100vw, 50vw" : "(max-width: 600px) 100vw, 33vw"} preload={priority} onError={()=>setFailed(true)} />
    : <span className="detail-poster-fallback" aria-hidden="true"><span>КИНО САЙТ</span><strong>{film.title}</strong></span>;
}

function Trailer({film, onClose}: {film:FilmDetails; onClose:()=>void}) {
  const [failed, setFailed] = useState(false);
  const {src, type} = getVideoEmbed(trailerUrl(film));
  return <div className="detail-trailer">
    {failed ? <div className="trailer-error" role="alert"><p>Трейлер ачаалсангүй. Холболтоо шалгаад дахин оролдоорой.</p><button className="secondary-button" onClick={()=>setFailed(false)}>Дахин оролдох</button></div>
      : type === "video" ? <video data-trailer src={src} autoPlay muted controls playsInline preload="metadata" onError={()=>setFailed(true)} />
      : <iframe title={`${film.title} — трейлер`} src={type === "youtube" ? `${src}&autoplay=1&mute=1` : src} allow="autoplay; fullscreen; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" onError={()=>setFailed(true)} />}
    <button className="trailer-close secondary-button" onClick={onClose}>Зураг руу буцах</button>
  </div>;
}

export default function FilmLanding(props:Props) {
  const {film, loading, error, onBack} = props;
  const [previewOpen, setPreviewOpen] = useState(false);
  const watch = () => {setPreviewOpen(false);props.onWatch();};
  const choosePlan = (plan:string) => {setPreviewOpen(false);props.onPlan(plan);};
  if (!film || loading || error) return <main className="film-destination catalog-shell">
    <button className="secondary-button film-back" onClick={onBack}>← Бүх кино</button>
    <section className="detail-loading" aria-busy={loading}>
      <h1 id="selected-film-title">{error ? "Кино нээгдсэнгүй" : "Киног нээж байна…"}</h1>
      {loading && <p role="status">Түр хүлээнэ үү…</p>}
      {error && <div className="film-link-error" role="alert"><p>{error}</p>{props.canRetry && <button className="secondary-button" onClick={props.onRetry}>Дахин оролдох</button>}</div>}
    </section>
  </main>;
  const category = filmCategory(film);
  const related = relatedFilms(props.films, film);
  const packages = filmPlans(film);
  const preview = trailerUrl(film);
  const busy = props.watching || !props.authReady;
  return <main className="film-destination catalog-shell">
    <nav className="detail-top" aria-label="Киноны навигац"><button className="secondary-button film-back" onClick={onBack}>← Бүх кино</button><span className="footer-brand">КИНО САЙТ</span></nav>
    <section className="film-landing" aria-labelledby="selected-film-title">
      <div className="detail-media">
        {previewOpen ? <Trailer film={film} onClose={()=>setPreviewOpen(false)} /> : <>
          <button className="detail-poster" onClick={()=>setPreviewOpen(true)} disabled={!preview} aria-label={`${film.title} — трейлер тоглуулах`}>
            <FilmImage key={film.img} film={film} priority />
            {preview && <span className="detail-play"><svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 4v16l13-8Z"/></svg><span>Трейлер үзэх</span></span>}
          </button>
          <p className="detail-media-caption">{preview ? "Зураг дээр дараад киноны хэсгээс үзээрэй." : "Трейлер удахгүй нэмэгдэнэ."}</p>
        </>}
      </div>
      <div className="film-landing-copy">
        <div className="detail-tags"><span>{category}{category === "Эротик" ? " · 18+" : ""}</span><span>{film.badge?.split("|")[0] || "Хэлтэй"}</span></div>
        <h1 id="selected-film-title">{film.title}</h1>
        <p className="detail-description">{film.description?.trim() || "Киноны тайлбар удахгүй нэмэгдэнэ."}</p>
        <dl className="detail-facts"><div><dt>Хувилбар</dt><dd>{film.badge?.split("|")[0] || "Хэлтэй"}</dd></div><div><dt>Үзсэн тоо</dt><dd>{Number(film.views || 0).toLocaleString("mn-MN")}</dd></div></dl>
        <p className="film-landing-price">{film.free || film.locked === false ? "Үнэгүй" : `${Number(film.price || 0).toLocaleString("mn-MN")}₮`}<span>{film.free || film.locked === false ? " · Шууд үзэх боломжтой" : " · Нэг кино, 3 хоног"}</span></p>
        <button className="primary-button film-continue" onClick={watch} disabled={busy}>{props.watching ? "Үзэх эрхийг шалгаж байна…" : "Бүтэн үзэх"}</button>
        <p className="film-landing-note">{props.available ? "Танд энэ киног үзэх эрх байна." : "Үзэх эрхгүй бол нэвтэрч, төлбөрөө баталгаажуулаад үргэлжлүүлнэ."}</p>
        {props.watchError && <p role="alert" className="detail-watch-error">{props.watchError}</p>}
      </div>
    </section>

    <section id="film-payment" className="detail-payment" aria-labelledby="film-payment-title">
      <div className="detail-section-heading"><span className="eyebrow">ҮЗЭХ ЭРХ</span><h2 id="film-payment-title">Төлбөр, шилжүүлэг</h2></div>
      {props.payment || <div className="detail-payment-start"><div><h3>{props.available ? "Киногоо үзэхэд бэлэн" : "Дансаар шилжүүлэх"}</h3><p>{props.available ? "Бүтэн үзэх товчийг дараарай." : "Үзэх эрх авах товчийг дарахад данс, шилжүүлэх дүн, гүйлгээний код гарна."}</p></div><button className="secondary-button" onClick={watch} disabled={busy}>{props.available ? "Бүтэн үзэх" : "Үзэх эрх авах"}</button></div>}
    </section>

    <section className="detail-related" aria-labelledby="related-title">
      <div className="detail-section-heading"><span className="eyebrow">{category.toLocaleUpperCase("mn-MN")}</span><h2 id="related-title">Хамгийн их үзсэн 3 кино</h2></div>
      {props.relatedError ? <div className="detail-related-error" role="alert"><p>Санал болгох киног ачаалж чадсангүй.</p><button className="secondary-button" onClick={props.onRetryRelated}>Дахин ачаалах</button></div>
        : props.relatedLoading ? <p role="status">Ижил ангиллын кинонуудыг ачаалж байна…</p>
        : related.length ? <div className="related-grid">{related.map((item,index)=><button className="related-film" key={item.id} onClick={()=>props.onFilm(item)}>
          <div className="related-poster"><FilmImage film={item}/><span className="related-rank">0{index+1}</span></div><div><h3>{item.title}</h3><p>{Number(item.views || 0).toLocaleString("mn-MN")} үзсэн · {item.badge?.split("|")[0] || "Хэлтэй"}</p></div>
        </button>)}</div> : <p>Энэ ангиллын өөр кино одоогоор алга.</p>}
    </section>

    {packages.length > 0 && <section className="detail-packages" aria-labelledby="detail-packages-title">
      <div className="detail-section-heading"><span className="eyebrow">БАГЦ АВАХ</span><h2 id="detail-packages-title">{category} киноны багц</h2><p>Энэ ангиллын бүх киног нэг эрхээр үзээрэй.</p></div>
      <div className="detail-plan-grid">{packages.map(plan=><article key={plan.id} className="detail-plan"><h3>{plan.days} хоног</h3><p>{plan.category} ангиллын бүх кино</p><strong>{plan.price.toLocaleString("mn-MN")}₮</strong><button className="primary-button" disabled={busy} onClick={()=>choosePlan(plan.id)} aria-label={`${plan.category} ${plan.days} хоногийн багц авах`}>Багц авах</button></article>)}</div>
      <p className="detail-package-note">Төлбөр баталгаажсан үеэс үзэх хугацаа эхэлнэ.</p>
    </section>}
  </main>;
}
