"use client";

import { useEffect } from "react";

export default function CatalogCardTuning() {
  useEffect(() => {
    const tuneCards = () => {
      document.querySelectorAll<HTMLElement>(".cinema-site .movie-card").forEach(card => {
        const badge = card.querySelector<HTMLElement>(".movie-badge");
        const category = card.querySelector<HTMLElement>(".movie-category")?.textContent?.trim();
        if (!badge || !category) return;
        badge.dataset.packageName = `${category} багц`;
      });
    };

    tuneCards();
    const observer = new MutationObserver(tuneCards);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
