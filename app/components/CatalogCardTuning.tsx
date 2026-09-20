"use client";

import { useEffect } from "react";

const TRAILER_REQUEST_KEY = "taza_open_trailer";
const PACKAGE_PRESET_KEY = "taza_package_preset";

export default function CatalogCardTuning() {
  useEffect(() => {
    const requestTrailerOpen = (card: HTMLElement) => {
      try { sessionStorage.setItem(TRAILER_REQUEST_KEY, "1"); } catch {}
      const main = card.querySelector<HTMLButtonElement>(".movie-main");
      main?.click();
    };

    const maybeOpenRequestedTrailer = () => {
      let requested = false;
      try { requested = sessionStorage.getItem(TRAILER_REQUEST_KEY) === "1"; } catch {}
      if (!requested) return;

      const poster = document.querySelector<HTMLButtonElement>(".film-destination .detail-poster:not(:disabled)");
      if (poster) {
        try { sessionStorage.removeItem(TRAILER_REQUEST_KEY); } catch {}
        window.setTimeout(() => poster.click(), 0);
        return;
      }

      const unavailablePoster = document.querySelector<HTMLButtonElement>(".film-destination .detail-poster:disabled");
      if (unavailablePoster) {
        try { sessionStorage.removeItem(TRAILER_REQUEST_KEY); } catch {}
      }
    };

    const applyPackagePreset = () => {
      let requested = false;
      try { requested = sessionStorage.getItem(PACKAGE_PRESET_KEY) === "all_48h"; } catch {}
      if (!requested) return;

      const dialog = document.querySelector<HTMLDialogElement>("dialog.package-dialog[open]");
      if (!dialog || dialog.dataset.promoPresetApplied === "1") return;

      const all = dialog.querySelector<HTMLInputElement>('input[name="package-category"][value="all"]');
      if (all && !all.checked) all.click();

      window.requestAnimationFrame(() => {
        const activeDialog = document.querySelector<HTMLDialogElement>("dialog.package-dialog[open]");
        if (!activeDialog) return;
        activeDialog.dataset.promoPresetApplied = "1";
        try { sessionStorage.removeItem(PACKAGE_PRESET_KEY); } catch {}
      });
    };

    const tunePromotions = () => {
      document.querySelectorAll<HTMLButtonElement>(".cinema-site .catalog-plan-banner").forEach(banner => {
        const copy = banner.firstElementChild as HTMLElement | null;
        const lead = copy?.querySelector<HTMLElement>("strong");
        const sub = copy ? Array.from(copy.children).find(child => child.tagName === "SPAN") as HTMLElement | undefined : undefined;
        const cta = banner.querySelector<HTMLElement>(".banner-cta");

        if (lead && lead.textContent !== "Сайтын бүх киног 7,900 төгрөгөөр") lead.textContent = "Сайтын бүх киног 7,900 төгрөгөөр";
        if (sub && sub.textContent !== "72 цаг үзэх эрх") sub.textContent = "72 цаг үзэх эрх";
        if (cta && cta.textContent !== "ЭНД ДАРЖ ҮЗЭХ →") cta.textContent = "ЭНД ДАРЖ ҮЗЭХ →";

        if (banner.dataset.packagePresetBound !== "1") {
          banner.dataset.packagePresetBound = "1";
          banner.addEventListener("click", () => {
            try { sessionStorage.setItem(PACKAGE_PRESET_KEY, "all_48h"); } catch {}
            const existing = document.querySelector<HTMLDialogElement>("dialog.package-dialog");
            if (existing) delete existing.dataset.promoPresetApplied;
            window.setTimeout(applyPackagePreset, 0);
            window.setTimeout(applyPackagePreset, 80);
            window.setTimeout(applyPackagePreset, 180);
          });
        }
      });
    };

    const tuneCards = () => {
      document.querySelectorAll<HTMLElement>(".cinema-site .movie-card").forEach(card => {
        const badge = card.querySelector<HTMLElement>(".movie-badge");
        const category = card.querySelector<HTMLElement>(".movie-category")?.textContent?.trim();
        if (badge && category) badge.dataset.packageName = `${category} багц`;

        if (!card.querySelector(".catalog-trailer-button")) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "catalog-trailer-button";
          button.innerHTML = '<span aria-hidden="true">▶</span><span>Трейлер үзэх</span>';
          const title = card.querySelector<HTMLElement>(".movie-info h3")?.textContent?.trim() || "Кино";
          button.setAttribute("aria-label", `${title} — трейлер үзэх`);
          button.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            requestTrailerOpen(card);
          });

          const oldHint = card.querySelector(".movie-detail-hint");
          if (oldHint) card.insertBefore(button, oldHint);
          else card.appendChild(button);
        }
      });

      tunePromotions();
      applyPackagePreset();
      maybeOpenRequestedTrailer();
    };

    tuneCards();
    const observer = new MutationObserver(tuneCards);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
