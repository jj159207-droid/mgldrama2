import { Fragment, useMemo, type ReactNode } from "react";
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
};

export default function CatalogBrowser<T extends CatalogFilm>({
  films, state, onChange, loading, error, onRetry, renderFilm, renderPromotion,
}: Props<T>) {
  // Removed controls must not leave invisible search/access/sort filters active.
  const results = useMemo(() => filterCatalog(films, {...INITIAL_CATALOG, category: state.category}), [films, state.category]);
  const change = (category: CatalogState["category"]) => onChange({...INITIAL_CATALOG, category});
  const isFiltered = state.category !== "Бүгд";
  const clear = () => onChange({...INITIAL_CATALOG});

  return <div className="catalog-browser">
    <div className="category-tabs" role="group" aria-label="Киноны ангилал">
      {CATEGORIES.map(category => <button type="button" key={category} aria-pressed={state.category === category} className={state.category === category ? "active" : ""} onClick={() => change(category)}>{category}{category === "Эротик" && <span className="age-label">21+</span>}</button>)}
    </div>
    {loading && <p className="sr-only" role="status">Кинонуудыг ачааллаж байна…</p>}
    {error && <div className="catalog-error" role="alert"><div><h2>Кинонуудыг ачаалж чадсангүй</h2><p>{error}</p>{films.length > 0 && <p>Өмнө ачаалсан жагсаалтыг харуулж байна.</p>}</div><button type="button" className="secondary-button" onClick={onRetry} disabled={loading}>{loading ? "Шалгаж байна…" : "Дахин оролдох"}</button></div>}
    {loading && films.length === 0 ? <div className="film-grid" aria-hidden="true">{Array.from({length: 6}, (_, i) => <div key={i} className="movie-skeleton"><div/><span/><span/></div>)}</div>
      : results.length > 0 ? <><div className="film-grid" aria-busy={loading}>{results.slice(0, state.visibleCount).map((film, index) => <Fragment key={film.id}>{renderFilm(film)}{renderPromotion && (index + 1) % 6 === 0 && renderPromotion()}</Fragment>)}</div>
        {results.length > state.visibleCount && <button type="button" className="secondary-button load-more" onClick={() => onChange({...state, visibleCount: state.visibleCount + 24})}>Дараагийн кинонууд ({results.length - state.visibleCount})</button>}</>
      : !loading && !error && <div className="empty-state"><h2>{isFiltered ? "Энэ ангилалд кино нэмэгдээгүй байна" : "Одоогоор кино нэмэгдээгүй байна"}</h2><p>{isFiltered ? "Өөр ангилал сонгоорой." : "Дараа дахин зочлоорой."}</p>{isFiltered && <button type="button" className="secondary-button" onClick={clear}>Бүх киног харах</button>}</div>}
  </div>;
}
