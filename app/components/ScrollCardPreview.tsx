"use client";

import { useEffect, useRef, useState } from "react";
import { cardPreviewSource } from "@/lib/card-preview";
import type { FilmDetails } from "@/lib/film-details";

type PreviewEntry = { node: HTMLElement; activate: (active: boolean) => void };

// A single document-wide coordinator avoids autoplaying many previews at once
// on a 2-column phone grid or a 6-column desktop grid.
const previews = new Set<PreviewEntry>();
let selected: PreviewEntry | null = null;
let hovered: PreviewEntry | null = null;
let frame = 0;

function visibleScore(node: HTMLElement): number | null {
  const rect = node.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const topLimit = Math.min(80, window.innerHeight * 0.15);
  const width = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
  const height = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, topLimit));
  const fraction = (width * height) / (rect.width * rect.height);
  if (fraction < 0.55) return null;
  const centerY = (window.innerHeight + topLimit) / 2;
  const centerX = window.innerWidth / 2;
  return fraction * 2
    - Math.abs((rect.top + rect.bottom) / 2 - centerY) / Math.max(window.innerHeight, 1) * 0.65
    - Math.abs((rect.left + rect.right) / 2 - centerX) / Math.max(window.innerWidth, 1) * 0.3;
}

function selectPreview(next: PreviewEntry | null) {
  if (selected === next) return;
  selected?.activate(false);
  selected = next;
  selected?.activate(true);
}

function updatePreview() {
  if (document.visibilityState === "hidden" ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ||
      (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) {
    selectPreview(null);
    return;
  }

  if (hovered && previews.has(hovered) && visibleScore(hovered.node) !== null) {
    selectPreview(hovered);
    return;
  }

  let best: PreviewEntry | null = null;
  let score = -Infinity;
  for (const entry of previews) {
    const current = visibleScore(entry.node);
    if (current !== null && current > score) {
      best = entry;
      score = current;
    }
  }
  selectPreview(best);
}

function schedulePreview() {
  if (!frame) frame = window.requestAnimationFrame(() => { frame = 0; updatePreview(); });
}

function attachPreviewListeners() {
  window.addEventListener("scroll", schedulePreview, { passive: true });
  window.addEventListener("resize", schedulePreview);
  document.addEventListener("visibilitychange", schedulePreview);
  window.addEventListener("pagehide", pauseAllPreviews);
}

function pauseAllPreviews() { selectPreview(null); }

function detachPreviewListeners() {
  window.removeEventListener("scroll", schedulePreview);
  window.removeEventListener("resize", schedulePreview);
  document.removeEventListener("visibilitychange", schedulePreview);
  window.removeEventListener("pagehide", pauseAllPreviews);
  if (frame) window.cancelAnimationFrame(frame);
  frame = 0;
  selected = null;
  hovered = null;
}

export default function ScrollCardPreview({ film }: { film: Pick<FilmDetails, "url" | "preview_url"> }) {
  const src = cardPreviewSource(film);
  const host = useRef<HTMLSpanElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const node = host.current;
    if (!node || !src || failed) return;
    let delay: ReturnType<typeof setTimeout> | null = null;
    const entry: PreviewEntry = {
      node,
      activate(shouldPlay) {
        if (delay) clearTimeout(delay);
        delay = shouldPlay ? setTimeout(() => { delay = null; setActive(true); }, 230) : null;
        if (!shouldPlay) { setActive(false); setReady(false); }
      },
    };

    const first = previews.size === 0;
    previews.add(entry);
    if (first) attachPreviewListeners();

    // Pointer hover is an explicit priority on desktop; touch scrolling is
    // selected by viewport position instead, without swallowing the click.
    const poster = node.parentElement;
    const enter = (event: PointerEvent) => {
      if (event.pointerType !== "touch") { hovered = entry; schedulePreview(); }
    };
    const leave = () => {
      if (hovered === entry) { hovered = null; schedulePreview(); }
    };
    poster?.addEventListener("pointerenter", enter);
    poster?.addEventListener("pointerleave", leave);
    schedulePreview();

    return () => {
      poster?.removeEventListener("pointerenter", enter);
      poster?.removeEventListener("pointerleave", leave);
      if (delay) clearTimeout(delay);
      previews.delete(entry);
      if (hovered === entry) hovered = null;
      if (selected === entry) selected = null;
      if (!previews.size) detachPreviewListeners();
      else schedulePreview();
    };
  }, [src, failed]);

  useEffect(() => {
    if (!active || failed) return;
    const element = video.current;
    if (!element) return;
    let disposed = false;
    element.muted = true;
    const attempt = element.play();
    attempt?.catch(() => { if (!disposed) setFailed(true); });
    return () => { disposed = true; element.pause(); };
  }, [active, failed]);

  if (!src || failed) return null;
  return <span ref={host} className="movie-card-autopreview" aria-hidden="true">
    {active && <video
      ref={video}
      className={ready ? "is-playing" : ""}
      src={src}
      muted
      autoPlay
      playsInline
      loop
      preload="metadata"
      tabIndex={-1}
      onPlaying={() => setReady(true)}
      onError={() => setFailed(true)}
      onStalled={() => setReady(false)}
      onPause={() => setReady(false)}
    />}
  </span>;
}
