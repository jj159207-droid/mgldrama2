"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { dbAll } from "@/lib/client";

type HeroFilm = {
  id: number;
  title: string;
  img?: string | null;
};

const MAX_HERO_FILMS = 9;

function circularOffset(index: number, active: number, count: number) {
  if (count <= 1) return 0;
  let offset = (index - active + count) % count;
  if (offset > count / 2) offset -= count;
  return offset;
}

function Carousel({ films, onOpenPlans }: { films: HeroFilm[]; onOpenPlans: () => void }) {
  const [active, setActive] = useState(0);
  const [failed, setFailed] = useState<Record<number, true>>({});
  const swipe = useRef({ startX: 0, moved: false });
  const count = films.length;

  useEffect(() => {
    if (active >= count) setActive(0);
  }, [active, count]);

  const previous = useCallback(() => {
    if (count > 1) setActive(value => (value - 1 + count) % count);
  }, [count]);

  const next = useCallback(() => {
    if (count > 1) setActive(value => (value + 1) % count);
  }, [count]);

  const openFilm = (film: HeroFilm) => {
    if (swipe.current.moved) {
      swipe.current.moved = false;
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set("film", String(film.id));
    window.location.assign(`${url.pathname}${url.search}${url.hash}`);
  };

  const pointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    swipe.current.startX = event.clientX;
    swipe.current.moved = false;
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch {}
  };

  const pointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (Math.abs(event.clientX - swipe.current.startX) > 12) swipe.current.moved = true;
  };

  const pointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const delta = event.clientX - swipe.current.startX;
    if (Math.abs(delta) >= 42) {
      swipe.current.moved = true;
      if (delta < 0) next(); else previous();
      window.setTimeout(() => { swipe.current.moved = false; }, 80);
    }
  };

  if (!count) return null;

  return (
    <section className="cinematic-hero-carousel" aria-label="Онцлох кинонууд">
      <div
        className="cinematic-hero-stage"
        tabIndex={0}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={() => { swipe.current.moved = false; }}
        onKeyDown={event => {
          if (event.key === "ArrowLeft") { event.preventDefault(); previous(); }
          if (event.key === "ArrowRight") { event.preventDefault(); next(); }
        }}
      >
        {films.map((film, index) => {
          const offset = circularOffset(index, active, count);
          const position = offset === 0 ? "current" : offset === -1 ? "previous" : offset === 1 ? "next" : offset < 0 ? "far-previous" : "far-next";
          const visible = Math.abs(offset) <= 1;
          return (
            <button
              type="button"
              key={film.id}
              className={`cinematic-hero-card is-${position}`}
              aria-label={offset === 0 ? `${film.title} — дэлгэрэнгүй үзэх` : `${film.title} — төвд гаргах`}
              aria-hidden={!visible}
              tabIndex={visible ? 0 : -1}
              onClick={() => offset === 0 ? openFilm(film) : setActive(index)}
            >
              <span className="cinematic-hero-frame">
                {film.img && !failed[film.id] ? (
                  <img
                    src={film.img}
                    alt=""
                    loading={Math.abs(offset) <= 1 ? "eager" : "lazy"}
                    decoding="async"
                    onError={() => setFailed(value => ({ ...value, [film.id]: true }))}
                  />
                ) : (
                  <span className="cinematic-hero-fallback" aria-hidden="true">ТАЗА САЙТ</span>
                )}
                <span className="cinematic-hero-shade" aria-hidden="true" />
                <strong className="cinematic-hero-title">{film.title}</strong>
              </span>
            </button>
          );
        })}

        {count > 1 && <>
          <button type="button" className="cinematic-hero-arrow cinematic-hero-arrow-left" aria-label="Өмнөх кино" onClick={previous}>‹</button>
          <button type="button" className="cinematic-hero-arrow cinematic-hero-arrow-right" aria-label="Дараагийн кино" onClick={next}>›</button>
        </>}
      </div>

      {count > 1 && (
        <div className="cinematic-hero-dots" role="group" aria-label="Кино сонгох">
          {films.map((film, index) => (
            <button
              type="button"
              key={film.id}
              aria-label={`${film.title} сонгох`}
              aria-pressed={index === active}
              className={index === active ? "active" : ""}
              onClick={() => setActive(index)}
            />
          ))}
        </div>
      )}

      <button type="button" className="cinematic-package-cta" onClick={onOpenPlans} aria-label="60 кино 8000 төгрөгийн үзэх багц сонгох">
        <svg className="cinematic-package-icon" viewBox="0 0 32 32" aria-hidden="true">
          <path d="M4 10.5 20.5 4l2 3.5a4 4 0 0 0 3.5 6.5l2 3.5L11.5 28l-2-3.5A4 4 0 0 0 6 18z" />
          <path d="m12 10 1.5 2.5M15 15l1.5 2.5M18 20l1.5 2.5" />
        </svg>
        <span><strong>60</strong> кино <strong>8000</strong> төгрөг үзэх багц</span>
      </button>
    </section>
  );
}

export default function CinematicHeroMount() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [films, setFilms] = useState<HeroFilm[]>([]);

  useEffect(() => {
    let cancelled = false;
    dbAll("films?select=id,title,img&order=id.desc", {}, true)
      .then(rows => {
        if (cancelled || !Array.isArray(rows)) return;
        const clean = rows
          .filter((film: any) => Number.isSafeInteger(Number(film?.id)) && String(film?.title || "").trim())
          .map((film: any) => ({ id: Number(film.id), title: String(film.title).trim(), img: typeof film.img === "string" ? film.img : "" }));
        const withPosters = clean.filter(film => film.img);
        setFilms((withPosters.length >= 3 ? withPosters : clean).slice(0, MAX_HERO_FILMS));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const sync = () => {
      const next = document.querySelector<HTMLElement>(".cinema-site .package-banner");
      setTarget(current => current === next ? current : next);
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!target || !films.length) return;
    target.classList.add("has-cinematic-carousel");
    return () => target.classList.remove("has-cinematic-carousel");
  }, [target, films.length]);

  const openPlans = useCallback(() => {
    const button = target?.querySelector<HTMLButtonElement>(".package-banner-action .primary-button");
    button?.click();
  }, [target]);

  const content = useMemo(() => films.length ? <Carousel films={films} onOpenPlans={openPlans} /> : null, [films, openPlans]);
  return target && content ? createPortal(content, target) : null;
}
