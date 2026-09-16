"use client";

import { useEffect, useRef, useState } from "react";
import { getVideoEmbed, trailerUrl, type FilmDetails } from "@/lib/film-details";

type Props = {
  film: Pick<FilmDetails, "preview_url" | "url">;
  className?: string;
};

export default function TrailerPosterFrame({ film, className = "" }: Props) {
  const host = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);
  const { src, type } = getVideoEmbed(trailerUrl(film));

  useEffect(() => {
    const node = host.current;
    if (!node || type !== "video" || !src || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: "220px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [src, type]);

  if (type !== "video" || !src) return null;
  const frameSrc = src.includes("#") ? src : src + "#t=0.1";
  return <span ref={host} className={"trailer-poster-frame-shell" + (className ? " " + className : "")} aria-hidden="true">
    {visible && <video
      className={"trailer-poster-frame" + (ready ? " ready" : "")}
      src={frameSrc}
      muted
      playsInline
      preload="metadata"
      tabIndex={-1}
      onLoadedData={() => setReady(true)}
    />}
  </span>;
}
