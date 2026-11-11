"use client";

import { useEffect, useRef } from "react";

type Props = {
  onAdult: () => void;
  onUnderage: () => void;
};

/** A deliberate self-declaration gate before the featured +21 checkout.
 * The underage/escape path never creates a bank order or opens a paywall.
 */
export default function TazaAdultAgePrompt({ onAdult, onUnderage }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const underageRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    underageRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = priorOverflow;
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="taza-adult-gate"
      aria-labelledby="taza-adult-gate-title"
      aria-describedby="taza-adult-gate-question"
      onCancel={event => { event.preventDefault(); onUnderage(); }}
      onClick={event => { if (event.target === event.currentTarget) onUnderage(); }}
    >
      <div className="taza-adult-gate-inner">
        <span className="taza-adult-gate-age" aria-hidden="true">+21</span>
        <h2 id="taza-adult-gate-title">Насны баталгаажуулалт</h2>
        <p id="taza-adult-gate-question">Энд кино байхгүй, зөвхөн +21 бичлэгүүд байгаа. Та нэвтрэх үү?</p>
        <div className="taza-adult-gate-actions">
          <button
            type="button"
            className="taza-adult-gate-adult"
            onClick={onAdult}
          >
            21 нас хүрсэн
          </button>
          <button
            ref={underageRef}
            type="button"
            className="taza-adult-gate-underage"
            onClick={onUnderage}
          >
            21 нас хүрээгүй
          </button>
        </div>
      </div>
    </dialog>
  );
}
