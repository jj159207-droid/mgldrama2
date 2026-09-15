"use client";

export default function ErrorPage({retry}: {error: Error & {digest?: string}; retry: () => void}) {
  const returnHome = () => {
    // A document reload deliberately discards the failed router tree.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/");
  };
  return <main className="catalog-shell recovery-page">
    <div className="empty-state" role="alert">
      <h1>Хуудсыг нээж чадсангүй</h1>
      <p>Түр зуурын алдаа гарлаа. Дахин оролдоорой.</p>
      <button type="button" className="primary-button" onClick={retry}>Дахин оролдох</button>
      <button type="button" className="secondary-button" onClick={returnHome}>Нүүр рүү буцах</button>
    </div>
  </main>;
}
