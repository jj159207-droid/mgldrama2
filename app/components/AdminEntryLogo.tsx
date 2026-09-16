"use client";

import { useRef } from "react";

// This gesture reveals the existing sign-in screen; it never grants admin access.
export default function AdminEntryLogo({ onOpen }: { onOpen: () => void }) {
  const taps = useRef<number[]>([]);
  const tap = () => {
    const now = performance.now();
    taps.current = [...taps.current.filter(time => now - time <= 8000), now];
    if (taps.current.length < 5) return;
    taps.current = [];
    onOpen();
  };
  return <button type="button" className="brand-logo-button" aria-label="ТАЗА САЙТ лого" onClick={tap} onKeyDown={event => { if (event.repeat) event.preventDefault(); }}>
    <span className="brand-symbol" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"><path d="m8 4 12 8-12 8Z" /></svg></span>
  </button>;
}
