import { Fragment, useMemo, useRef, type ReactNode } from "react";
import { CATEGORIES, INITIAL_CATALOG, filterCatalog, type CatalogFilm, type CatalogState } from "@/lib/catalog";

type Props<T extends CatalogFilm> = {
  films: T[];
  state: CatalogState;
  onChange: (state: CatalogState) => void;
  loading: boolean;
  error: string;
  onRetry: () => void;
  renderFilm: (film: T) => ReactNode;
  renderPromotion?: () => ReactNode;
  autoFocus?: boolean;
};

export default function CatalogBrowser<T extends CatalogFilm>({
  films, state, onChange, loading, error, onRetry, renderFilm, renderPromotion, autoFocus = false,
}: Props<T>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useMemo(() => filterCatalog(films, state), [films, state]);
  const change = (patch: Partial<CatalogState>) => onChange({...state, ...patch, visibleCount: 24});
  const isFiltered = !!state.query.trim() || state.category !== "Бүгд" || state.access !== "all";
  const clear = () => { onChange({...INITIAL_CATALOG, sort: state.sort}); inputRef.current?.focus(); };

  return <div className="catalog-browser">
    <div className="catalog-controls">
      <div role="search" className="catalog-input-wrap">
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>
        <input ref={inputRef} type="search" aria-label="Киноны нэрээр хайх" placeholder="Киноны нэрээр хайх…" value={state.query} autoFocus={autoFocus} autoComplete="off" enterKeyHint="search" onChange={e => change({query: e.target.value})} onKeyDown={e => {if(e.key === "Escape") {change({query: ""}); e.stopPropagation();}}}/>
        {state.query && <button type="button" className="catalog-clear" aria-label="Хайлтыг цэвэрлэх" onClick={() => {change({query: ""}); inputRef.current?.focus();}}>×</button>}
      </div>
      <label className="catalog-select"><span>Дараалал</span><select value={state.sort} onChange={e => change({sort: e.target.value as CatalogState["sort"]})}>
        <option value="newest">Сүүлд нэмэгдсэн</option><option value="popular">Их үзсэн</option><option value="title">Нэрээр</option>
      </select></label>
    </div>
    <div className="category-tabs" role="group" aria-label="Киноны ангилал">
      {CATEGORIES.map(category => <button type="button" key={category} aria-pressed={state.category === category} className={state.category === category ? "active" : ""} onClick={() => change({category})}>{category}{category === "Эротик" && <span className="age-label">18+</span>}</button>)}
    </div>
    <div className="catalog-results-bar">
      <label className="catalog-access"><span>Үзэх эрх</span><select value={state.access} onChange={e => change({access: e.target.value as CatalogState["access"]})}><option value="all">Бүх кино</option><option value="available">Шууд үзэх</option><option value="free">Зөвхөн үнэгүй</option></select></label>
      <p role="status" aria-live="polite" aria-atomic="true">{loading ? "Кинонуудыг ачааллаж байна…" : error ? "Жагсаалтыг шинэчилж чадсангүй" : `${results.length} кино${isFiltered ? " олдлоо" : " байна"}`}</p>
      {isFiltered && <button type="button" className="quiet-button catalog-reset" onClick={clear}>Сонголтыг цэвэрлэх</button>}
    </div>
    {error && <div className="catalog-error" role="alert"><div><h2>Кинонуудыг ачаалж чадсангүй</h2><p>{error}</p>{films.length > 0 && <p>Өмнө ачаалсан жагсаалтыг харуулж байна.</p>}</div><button type="button" className="secondary-button" onClick={onRetry} disabled={loading}>{loading ? "Шалгаж байна…" : "Дахин оролдох"}</button></div>}
    {loading && films.length === 0 ? <div className="film-grid" aria-hidden="true">{Array.from({length: 6}, (_, i) => <div key={i} className="movie-skeleton"><div/><span/><span/></div>)}</div>
      : results.length > 0 ? <><div className="film-grid" aria-busy={loading}>{results.slice(0, state.visibleCount).map((film, index) => <Fragment key={film.id}>{renderFilm(film)}{renderPromotion && (index + 1) % 6 === 0 && renderPromotion()}</Fragment>)}</div>
        {results.length > state.visibleCount && <button type="button" className="secondary-button load-more" onClick={() => onChange({...state, visibleCount: state.visibleCount + 24})}>Дараагийн кинонууд ({results.length - state.visibleCount})</button>}</>
      : !loading && !error && <div className="empty-state"><h2>{isFiltered ? "Тохирох кино олдсонгүй" : "Одоогоор кино нэмэгдээгүй байна"}</h2><p>{state.access === "available" ? "Үнэгүй болон таны үзэх эрхтэй кино энд харагдана. Худалдан авсан бол бүртгэлээрээ нэвтэрнэ үү." : isFiltered ? "Нэрээ богиносгож хайх эсвэл өөр ангилал сонгоорой." : "Дараа дахин зочлоорой."}</p>{isFiltered && <button type="button" className="secondary-button" onClick={clear}>Бүх киног харах</button>}</div>}
  </div>;
}
