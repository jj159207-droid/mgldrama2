'use client';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { formatTrailerTime, generatedTrailerStart, isBunnySource, parseTimeParts, timeParts, TRAILER_SECONDS } from '@/lib/trailer-spec';
export type TrailerEditorHandle = { prepare: () => Promise<string> };
type Props = { filmId: number; videoUrl: string; value: string; onChange: (value: string) => void; onBusyChange: (busy: boolean) => void; disabled?: boolean };
const input = { width: '100%', minWidth: 0, padding: '12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: 16 };
const label = { display: 'block', fontSize: 13, marginBottom: 6, color: 'var(--muted)' };
const TrailerEditor = forwardRef<TrailerEditorHandle, Props>(function TrailerEditor({ filmId, videoUrl, value, onChange, onBusyChange, disabled }, ref) {
  const savedStart = generatedTrailerStart(value);
  const [mode, setMode] = useState<'auto' | 'link'>(() => savedStart !== null || (!value && isBunnySource(videoUrl)) ? 'auto' : 'link');
  const [parts, setParts] = useState(() => timeParts(savedStart ?? 0));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(savedStart !== null ? value : '');
  const [playError, setPlayError] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const active = useRef(true);
  const generated = useRef<{ source: string; start: number; url: string } | null>(savedStart !== null ? { source: videoUrl.trim(), start: savedStart, url: value } : null);
  const start = parseTimeParts(...parts);
  useEffect(() => { active.current = true; return () => { active.current = false; pending.current?.abort(); }; }, []);
  const prepare = async (): Promise<string> => {
    if (mode === 'link') return value.trim();
    if (start === null) throw new Error('Цаг 0–99, минут болон секунд 0–59 хооронд байна. Бүх нүдийг бөглөнө үү.');
    if (!isBunnySource(videoUrl)) throw new Error('Видео URL хэсэгт Bunny Stream-ийн холбоос оруулна уу.');
    if (generated.current?.source === videoUrl.trim() && generated.current.start === start) return generated.current.url;
    if (pending.current) throw new Error('Трейлэр үүсгэж байна.');
    const controller = new AbortController(); pending.current = controller;
    const timer = setTimeout(() => controller.abort(), 185000);
    setBusy(true); onBusyChange(true); setError('');
    try {
      const response = await fetch('/api/trailers', { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ filmId, sourceUrl: videoUrl.trim(), startSeconds: start }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(typeof data?.message === 'string' ? data.message : 'Трейлэр үүсгэж чадсангүй. Дахин оролдоно уу.');
      if (typeof data?.previewUrl !== 'string' || data.durationSeconds !== TRAILER_SECONDS || generatedTrailerStart(data.previewUrl) !== start)
        throw new Error('Трейлэрийн хариу баталгаажаагүй байна.');
      if (!active.current) throw new DOMException('Cancelled', 'AbortError');
      generated.current = { source: videoUrl.trim(), start, url: data.previewUrl };
      onChange(data.previewUrl); setPreview(data.previewUrl); setPlayError(false);
      return data.previewUrl;
    } catch (err) {
      const message = controller.signal.aborted ? 'Үйлдэл цуцлагдсан эсвэл холболт удаан байна. Дахин оролдоно уу.' : err instanceof TypeError ? 'Интернэт холболтоо шалгаад дахин оролдоно уу.' : err instanceof Error ? err.message : 'Трейлэр үүсгэж чадсангүй.';
      if (active.current) setError(message);
      if (!active.current) throw new DOMException('Cancelled', 'AbortError');
      throw new Error(message);
    } finally {
      clearTimeout(timer); pending.current = null;
      if (active.current) { setBusy(false); onBusyChange(false); }
    }
  };
  useImperativeHandle(ref, () => ({ prepare }));
  return <section aria-label="Трейлэрийн тохиргоо" style={{ marginTop: 14, padding: 14, border: '1px solid var(--border)', borderRadius: 12 }}>
    <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>Трейлэр</h3>
    <label style={label} htmlFor={`trailer-mode-${filmId}`}>Трейлэрийн эх үүсвэр</label>
    <select id={`trailer-mode-${filmId}`} style={input} disabled={disabled || busy} value={mode} onChange={e => { setMode(e.target.value as 'auto' | 'link'); setError(''); }}>
      <option value="auto">Энэ киноноос 12 секунд</option><option value="link">Тусдаа трейлэрийн холбоос</option>
    </select>
    {mode === 'auto' ? <>
      <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--muted)' }}>Дээрх видео URL-д холбогдсон киноны аль хэсгээс эхлэхийг сонгоно уу.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8 }}>
        {(['Цаг', 'Минут', 'Секунд'] as const).map((name, index) => <label key={name} style={label}>{name}
          <input aria-label={`Трейлэр эхлэх ${name.toLowerCase()}`} style={{ ...input, marginTop: 6 }} type="number" inputMode="numeric" min="0" max={index === 0 ? 99 : 59} step="1" disabled={disabled || busy} value={parts[index]}
            onChange={e => { const next = [...parts] as typeof parts; next[index] = e.target.value; setParts(next); setError(''); }} />
        </label>)}
      </div>
      <p aria-live="polite" style={{ fontSize: 13 }}>{start === null ? 'Цаг, минут, секундийг зөв оруулна уу.' : `${formatTrailerTime(start)} → ${formatTrailerTime(start + TRAILER_SECONDS)} · 12 секунд`}</p>
      <button type="button" className="secondary-button" disabled={disabled || busy || start === null} onClick={() => { void prepare().catch(() => {}); }}>{busy ? '12 секундын бичлэг үүсгэж байна…' : '12 секундийг шалгах'}</button>
      <p style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--muted)' }}>“Хадгалах” дарахад сонгосон 12 секундийг автоматаар үүсгэнэ. Бүтэн киноны үзэх эрх өөрчлөгдөхгүй.</p>
      {preview && !playError && <video key={preview} aria-label="Үүсгэсэн 12 секундын трейлэр" src={preview} controls playsInline preload="metadata" onError={() => setPlayError(true)} style={{ width: '100%', borderRadius: 10 }} />}
      {playError && <p role="alert">Урьдчилсан бичлэг ачаалсангүй. Холболтоо шалгана уу.</p>}
      {preview && <p style={{ fontSize: 12, color: 'var(--muted)' }}>Үүсгэсэн хэсэг: {formatTrailerTime(generatedTrailerStart(preview) ?? 0)}. Киноны өөрчлөлтийг “Хадгалах” дарж нийтэлнэ.</p>}
    </> : <label style={{ ...label, marginTop: 12 }}>Трейлерийн холбоос (богино хэсэг)<input style={{ ...input, marginTop: 6 }} value={value} disabled={disabled || busy} onChange={e => onChange(e.target.value)} placeholder="https://your.b-cdn.net/preview.mp4" /></label>}
    {error && <p role="alert" style={{ color: '#f87171', fontSize: 13 }}>{error}</p>}
  </section>;
});
export default TrailerEditor;
