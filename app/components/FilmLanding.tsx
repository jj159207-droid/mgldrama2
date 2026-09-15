import { safeUrl } from "@/lib/domain";

type Film = {id: number; title: string; img?: string; badge?: string; price?: number};
type Props = {
  film: Film | null;
  loading: boolean;
  error: string;
  canRetry: boolean;
  signedIn: boolean;
  onContinue: () => void;
  onRetry: () => void;
  onBack: () => void;
};

export default function FilmLanding({film, loading, error, canRetry, signedIn, onContinue, onRetry, onBack}: Props) {
  const poster = safeUrl(film?.img || "", true);
  return <main className="film-destination catalog-shell">
    <button className="secondary-button film-back" onClick={onBack}>← Бүх кино</button>
    <section className="film-landing" aria-busy={loading} aria-labelledby="selected-film-title">
      {poster && <img className="film-landing-poster" src={poster} alt={film?.title || ""} decoding="async" />}
      <div className="film-landing-copy">
        <span className="eyebrow">ТАНЫ СОНГОСОН КИНО</span>
        <h1 id="selected-film-title">{film?.title || (error ? "Кино нээгдсэнгүй" : "Киног нээж байна…")}</h1>
        {film?.badge && <p className="film-landing-category">{film.badge.split("|").join(" · ")}</p>}
        {loading && <p role="status">Түр хүлээнэ үү. Үзэх эрхийг шалгаж байна…</p>}
        {error && <div className="film-link-error" role="alert"><p>{error}</p>{canRetry && <button className="secondary-button" onClick={onRetry}>Дахин оролдох</button>}</div>}
        {film && !loading && !error && <>
          <p>Энэ киноны үзэх эрхийг аваад үргэлжлүүлнэ.</p>
          <p className="film-landing-price">{Number(film.price || 0).toLocaleString("mn-MN")}₮ <span>· 3 хоног үзнэ</span></p>
          <button className="primary-button film-continue" onClick={onContinue}>{signedIn ? "Үзэх эрх авах" : "Нэвтрээд үргэлжлүүлэх"}</button>
          <p className="film-landing-note">{signedIn ? "Төлбөр баталгаажихад энэ кино нээгдэнэ." : "Нэвтэрсний дараа энэ киногоо үргэлжлүүлнэ. Бүртгэлгүй бол шинээр бүртгүүлж болно."}</p>
        </>}
      </div>
    </section>
  </main>;
}
