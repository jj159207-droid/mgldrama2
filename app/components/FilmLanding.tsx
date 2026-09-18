import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import { safeUrl } from "@/lib/domain";
import { filmCategory } from "@/lib/catalog";
import { filmPlans, getVideoEmbed, relatedFilms, trailerUrl, type FilmDetails } from "@/lib/film-details";
import TrailerPosterFrame from "@/app/components/TrailerPosterFrame";

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
  walletBalance: number;
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
  return src && !failed
    ? <Image unoptimized src={src} alt={film.title} fill sizes={priority ? "(max-width: 760px) 100vw, 760px" : "(max-width: 760px) 31vw, 260px"} preload={priority} onError={()=>setFailed(true)} />
    : <><span className="detail-poster-fallback" aria-hidden="true"><span>ТАЗА САЙТ</span><strong>{film.title}</strong></span><TrailerPosterFrame film={film} className="detail-poster-video" /></>;
}

function Trailer({film, onClose}: {film:FilmDetails; onClose:()=>void}) {
  const [failed, setFailed] = useState(false);
  const {src, type} = getVideoEmbed(trailerUrl(film));
  return <div className="detail-trailer">
    {failed ? <div className="trailer-error" role="alert"><p>Трейлер ачаалсангүй. Холболтоо шалгаад дахин оролдоорой.</p><button className="secondary-button" onClick={()=>setFailed(false)}>Дахин оролдох</button></div>
      : type === "video" ? <video data-trailer src={src} autoPlay muted controls playsInline preload="metadata" onError={()=>setFailed(true)} />
      : <iframe title={`${film.title} — трейлер`} src={type === "youtube" ? `${src}&autoplay=1&mute=1` : src} allow="autoplay; fullscreen; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" onError={()=>setFailed(true)} />}
    <button className="trailer-close secondary-button" onClick={onClose}>Зураг харах</button>
  </div>;
}

export default function FilmLanding(props:Props) {
  const {film, loading, error, onBack} = props;
  const [previewOpen, setPreviewOpen] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

  useEffect(() => {
    if (film && trailerUrl(film)) setPreviewOpen(true);
  }, [film?.id]);

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
  const description = film.description?.trim() || "";
  const priceLabel = film.free || film.locked === false ? "Үнэгүй" : `${Number(film.price || 0).toLocaleString("mn-MN")}₮`;
  const language = film.badge?.split("|")[0] || "Хэлтэй";

  return <main className="film-destination catalog-shell film-reference-page">
    <nav className="detail-top" aria-label="Киноны навигац">
      <button className="icon-button film-back" onClick={onBack} aria-label="Нүүр рүү буцах">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m15 4-8 8 8 8"/></svg>
      </button>
      <span className="detail-brand"><span className="brand-symbol" aria-hidden="true">▶</span>ТАЗА САЙТ</span>
      <span aria-hidden="true"/>
    </nav>

    <section className={`film-landing film-showcase${previewOpen ? " preview-playing" : ""}`} aria-labelledby="selected-film-title">
      <div className="detail-media film-hero-media">
        {previewOpen ? <Trailer film={film} onClose={()=>setPreviewOpen(false)} /> : <>
          <button className="detail-poster" onClick={()=>preview && setPreviewOpen(true)} disabled={!preview} aria-label={preview ? `${film.title} — трейлер тоглуулах` : film.title}>
            <FilmImage key={film.img} film={film} priority />
            {preview && <span className="detail-play"><svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 4v16l13-8Z"/></svg><span>Трейлер үзэх</span></span>}
          </button>
        </>}
        <div className="film-hero-overlay">
          <h1 id="selected-film-title">{film.title}</h1>
          <button className="film-hero-watch" onClick={watch} disabled={busy}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 4v16l13-8Z"/></svg>
            {props.watching ? "Шалгаж байна…" : "Үзэх"}
          </button>
        </div>
      </div>
      {props.available && <p className="film-landing-note">Танд энэ киног үзэх эрх байна.</p>}
      {props.watchError && <p role="alert" className="detail-watch-error">{props.watchError}</p>}
    </section>

    <section className="detail-related detail-related-primary" aria-label="Санал болгох төстэй кино">
      <h2>Санал болгох төстэй кино</h2>
      {props.relatedError ? <div className="detail-related-error" role="alert"><p>Санал болгох киног ачаалж чадсангүй.</p><button className="secondary-button" onClick={props.onRetryRelated}>Дахин ачаалах</button></div>
        : props.relatedLoading ? <p role="status">Ижил ангиллын кинонуудыг ачаалж байна…</p>
        : related.length ? <div className="related-grid">{related.map(item=><button className="related-film" key={item.id} onClick={()=>props.onFilm(item)}>
          <div className="related-poster"><FilmImage film={item}/></div>
          <div><h3>{item.title}</h3></div>
        </button>)}</div> : <p>Энэ ангиллын өөр кино одоогоор алга.</p>}
    </section>

    <section className="film-detail-info">
      <div className="film-detail-meta">
        <span><strong>{priceLabel}</strong></span>
        <span>◉ {Number(film.views || 0).toLocaleString("mn-MN")}</span>
        <span>{language}</span>
        <span>{category}{category === "Эротик" ? " · 21+" : ""}</span>
      </div>

      {!film.free && film.locked !== false && <p className="film-wallet-balance"><span>Таны кино сайтын дансны үлдэгдэл</span><strong>{Number(props.walletBalance || 0).toLocaleString("mn-MN")}₮</strong></p>}

      {description && <div className="detail-summary">
        <p id="film-description" className={`detail-description${descriptionExpanded ? " expanded" : ""}`}>{description}</p>
        {description.length > 90 && <button className="detail-description-toggle" aria-expanded={descriptionExpanded} aria-controls="film-description" onClick={()=>setDescriptionExpanded(!descriptionExpanded)}>{descriptionExpanded ? "Хураах" : "Дэлгэрэнгүй"}</button>}
      </div>}
    </section>

    {props.payment && <section id="film-payment" className="detail-payment" aria-label="Данс цэнэглэх">
      {props.payment}
    </section>}

    {packages.length > 0 && <section className="detail-packages" aria-label="Киноны багц">
      <div className="detail-plan-grid">{packages.map((plan,index)=><article key={plan.id} className="detail-plan"><svg className="plan-calendar" width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 2v6m10-6v6M3 11h18M7 15h2m3 0h2m3 0h1M7 18h2m3 0h2"/></svg><span className="eyebrow">60 кино үзэх эрх</span><h3>{plan.days} хоног</h3><strong>{plan.price.toLocaleString("mn-MN")}₮</strong><button className={index === 0 ? "secondary-button" : "primary-button"} disabled={busy} onClick={()=>choosePlan(plan.id)} aria-label={`${plan.category} ${plan.days} хоногийн багц авах`}>Багц авах</button></article>)}</div>
    </section>}
  </main>;
}
