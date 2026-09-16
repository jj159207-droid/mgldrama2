'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

const AGE_GATE_KEY = 'taza_age_21_v1';

type Props = { children: ReactNode };

export default function AgeGate({ children }: Props) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const adultButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    try {
      setAllowed(window.localStorage.getItem(AGE_GATE_KEY) === 'yes');
    } catch {
      setAllowed(false);
    }
  }, []);

  useEffect(() => {
    if (allowed === false) adultButton.current?.focus();
  }, [allowed]);

  const enter = () => {
    try { window.localStorage.setItem(AGE_GATE_KEY, 'yes'); } catch {}
    setAllowed(true);
  };

  const leave = () => {
    try { window.localStorage.removeItem(AGE_GATE_KEY); } catch {}
    if (window.history.length > 1) {
      window.history.back();
      window.setTimeout(() => {
        if (document.visibilityState === 'visible') window.location.replace('about:blank');
      }, 500);
      return;
    }
    window.location.replace('about:blank');
  };

  if (allowed === true) return <>{children}</>;

  return (
    <main
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-gate-title"
      aria-describedby="age-gate-description"
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background: '#07090d',
        color: '#f8fafc',
      }}
    >
      <section style={{ width: '100%', maxWidth: 430, textAlign: 'center' }}>
        <div aria-hidden="true" style={{ fontSize: 46, marginBottom: 18 }}>21+</div>
        <h1 id="age-gate-title" style={{ margin: 0, fontSize: 26, lineHeight: 1.25 }}>
          Та 21 нас хүрсэн үү?
        </h1>
        <p id="age-gate-description" style={{ margin: '14px 0 24px', color: '#aab4c3', lineHeight: 1.6 }}>
          Энэ сайт зөвхөн 21 нас хүрсэн хэрэглэгчдэд зориулагдсан. Үргэлжлүүлэхийн тулд насаа баталгаажуулна уу.
        </p>
        {allowed === null ? (
          <p role="status" style={{ color: '#aab4c3' }}>Шалгаж байна…</p>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            <button
              ref={adultButton}
              type="button"
              onClick={enter}
              style={{
                minHeight: 52,
                border: 0,
                borderRadius: 12,
                background: '#e5b53b',
                color: '#111827',
                fontSize: 16,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Тийм, би 21 нас хүрсэн
            </button>
            <button
              type="button"
              onClick={leave}
              style={{
                minHeight: 52,
                borderRadius: 12,
                border: '1px solid #364152',
                background: '#111827',
                color: '#e5e7eb',
                fontSize: 16,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Үгүй, 21 нас хүрээгүй
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
