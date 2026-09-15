'use client';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { requestJson } from '@/lib/client';
import { prepareChatImage, type ChatMessage, type ChatThread } from '@/lib/chat-client';

// Each visible view has one request in flight. Hidden tabs pause; reopening and
// reconnection refresh immediately. Errors retain the last usable conversation.
function useChatPoll(load: (signal: AbortSignal) => Promise<void>, delay: number, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    let stopped = false, running = false, timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    const tick = async () => {
      clearTimeout(timer);
      if (running || stopped) return;
      running = true;
      try { if (document.visibilityState !== 'hidden') await load(controller.signal); }
      catch { /* The view owns its error state. */ }
      finally { running = false; if (!stopped) timer = setTimeout(tick, delay); }
    };
    void tick();
    document.addEventListener('visibilitychange', tick); window.addEventListener('online', tick);
    window.addEventListener('kinoChatChanged', tick);
    return () => { stopped = true; controller.abort(); clearTimeout(timer); document.removeEventListener('visibilitychange', tick); window.removeEventListener('online', tick); window.removeEventListener('kinoChatChanged', tick); };
  }, [load, delay, enabled]);
}

export function useChatUnread(owner: string | number | null) {
  const [badge, setBadge] = useState({owner, count: 0});
  const load = useCallback(async (signal: AbortSignal) => {
    const result = await requestJson('/api/chat?summary=1', {signal}, true);
    if (!signal.aborted) setBadge({owner, count: Number(result.unread)});
  }, [owner]);
  useChatPoll(load, 15000, owner !== null);
  return owner !== null && badge.owner === owner ? badge.count : 0;
}

export function ChatBadge({count}: {count: number}) {
  return count > 0 ? <span className="chat-badge" aria-label={`${count} уншаагүй мессеж`}>{count > 99 ? '99+' : count}</span> : null;
}

function ImageViewer({url, onClose}: {url: string; onClose: () => void}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="chat-image-viewer" onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }} aria-label="Чатны зураг">
    <button autoFocus type="button" className="chat-close-image" onClick={onClose}>✕ Хаах</button>
    <img src={url} alt="Чатаар илгээсэн зураг" />
  </dialog>;
}

interface PendingMessage { message: string; image: string | null; client_id: string }
export function ChatPanel({admin = false, userId, title = 'Админтай чатлах', onBack, children}: {
  admin?: boolean; userId?: number; title?: string; onBack?: () => void; children?: ReactNode;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [text, setText] = useState(''), [image, setImage] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false), [sending, setSending] = useState(false);
  const [failed, setFailed] = useState<PendingMessage | null>(null), [sendError, setSendError] = useState('');
  const [viewImage, setViewImage] = useState<string | null>(null), [atEnd, setAtEnd] = useState(true);
  const list = useRef<HTMLDivElement>(null), fileInput = useRef<HTMLInputElement>(null), input = useRef<HTMLTextAreaElement>(null);
  const sendLock = useRef(false), prepareLock = useRef(false), scrollEnd = useRef(true), alive = useRef(true), readLock = useRef(false);
  const readThrough = useRef(0), messagesRef = useRef<ChatMessage[]>([]), initialized = useRef(false);
  const loadVersion = useRef(0);
  const mySender = admin ? 'admin' : 'user', owner = admin ? {user: userId} : {};
  const endpoint = admin ? `/api/chat?user=${userId}` : '/api/chat';
  useEffect(() => { alive.current = true; return () => {alive.current = false;}; }, []);
  const load = useCallback(async (signal?: AbortSignal) => {
    const version = ++loadVersion.current;
    try {
      const data = await requestJson(endpoint, {signal}, true);
      if (!signal?.aborted && alive.current && version === loadVersion.current) {
        setMessages(data.messages); messagesRef.current = data.messages; setError('');
        setFailed(prev => prev && data.messages.some((m: ChatMessage) => m.client_id === prev.client_id && m.sender === (admin ? 'admin' : 'user')) ? null : prev);
      }
    } catch (e) { if (!signal?.aborted && alive.current && version === loadVersion.current) setError(e instanceof Error ? e.message : 'Чат ачаалсангүй.'); }
    finally { if (!signal?.aborted && alive.current && version === loadVersion.current) setLoading(false); }
  }, [endpoint, admin]);
  useChatPoll(load, 4000);

  const acknowledge = useCallback(async () => {
    if (readLock.current || !scrollEnd.current || document.visibilityState === 'hidden' || !document.hasFocus()) return;
    const unseen = messagesRef.current.filter(m => m.sender !== mySender && !m.read_at && m.id > readThrough.current);
    if (!unseen.length) return;
    const through = unseen[unseen.length - 1].id;
    readLock.current = true;
    try {
      await requestJson('/api/chat', {method: 'PATCH', body: JSON.stringify({...(admin ? {user: userId} : {}), through})}, true);
      readThrough.current = through;
      window.dispatchEvent(new Event('kinoChatChanged'));
    } catch { /* Retry on the next poll; never optimistically claim it was read. */ }
    finally { readLock.current = false; }
  }, [admin, userId, mySender]);
  useEffect(() => {
    const element = list.current;
    if (element && (scrollEnd.current || !initialized.current)) {
      element.scrollTop = element.scrollHeight; scrollEnd.current = true; initialized.current = true;
    }
    void acknowledge();
  }, [messages, acknowledge]);
  useEffect(() => {
    const visible = () => {void acknowledge();};
    document.addEventListener('visibilitychange', visible); window.addEventListener('focus', visible);
    return () => {document.removeEventListener('visibilitychange', visible); window.removeEventListener('focus', visible);};
  }, [acknowledge]);
  const scrollToEnd = () => { if (list.current) list.current.scrollTop = list.current.scrollHeight; scrollEnd.current = true; setAtEnd(true); void acknowledge(); };
  const chooseImage = async (file?: File) => {
    if (!file || prepareLock.current || sendLock.current) return;
    prepareLock.current = true; setPreparing(true); setSendError('');
    try { const prepared = await prepareChatImage(file); if (alive.current) setImage(prepared); }
    catch (e) { if (alive.current) setSendError(e instanceof Error ? e.message : 'Зураг бэлтгэсэнгүй.'); }
    finally {prepareLock.current = false; if (alive.current) setPreparing(false); if (fileInput.current) fileInput.current.value = '';}
  };
  const send = async (retry?: PendingMessage) => {
    if (sendLock.current || prepareLock.current || (!retry && !text.trim() && !image)) return;
    const payload = retry || {message: text.trim(), image, client_id: crypto.randomUUID()};
    sendLock.current = true; setSending(true); setSendError('');
    if (!retry) {setText(''); setImage(null);}
    try {
      const result = await requestJson('/api/chat', {method: 'POST', body: JSON.stringify({...owner, ...payload})}, true);
      if (!alive.current) return;
      loadVersion.current++;
      setFailed(null); scrollEnd.current = true; setAtEnd(true);
      setMessages(prev => [...prev.filter(m => m.id !== result.message.id), result.message].sort((a,b) => a.id-b.id).slice(-100));
      window.dispatchEvent(new Event('kinoChatChanged')); void load(); input.current?.focus();
    } catch (e) {
      if (alive.current) {setFailed(payload); setSendError(e instanceof Error ? e.message : 'Илгээсэнгүй. Дахин оролдоно уу.');}
    } finally {sendLock.current = false; if (alive.current) setSending(false);}
  };
  return <section className="support-chat" aria-label={title}>
    <header className="chat-heading">
      {onBack && <button type="button" className="chat-icon" onClick={onBack} aria-label="Чатаас буцах">←</button>}
      <div className="chat-avatar" aria-hidden="true">{admin ? 'Х' : 'А'}</div>
      <div><h2>{title}</h2><p>{admin ? 'Хэрэглэгчтэй хувийн харилцан яриа' : 'Асуух зүйлээ бичээрэй. Бид энд хариулна.'}</p></div>
    </header>
    {children}
    <div className="chat-history" ref={list} role="log" aria-label="Мессежүүд" aria-live="polite" aria-relevant="additions text" onScroll={() => {
      const el = list.current!; const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
      scrollEnd.current = bottom; setAtEnd(bottom); if (bottom) void acknowledge();
    }}>
      <p className="chat-retention">Сүүлийн 100 мессеж хадгалагдана. Шинэ мессеж нэмэгдэхэд хамгийн хуучин нь зурагтайгаа устна.</p>
      {loading && <p className="chat-empty" role="status">Чат ачаалж байна…</p>}
      {!loading && !error && !messages.length && <div className="chat-empty"><span aria-hidden="true">💬</span><h3>Яриагаа эхлүүлье</h3><p>Асуулт, төлбөрийн баримт эсвэл дэлгэцийн зургаа илгээгээрэй.</p></div>}
      {messages.map((m, i) => <div key={m.id}>
        {(i === 0 || new Date(messages[i-1].created_at).toDateString() !== new Date(m.created_at).toDateString()) && <div className="chat-day">{new Date(m.created_at).toLocaleDateString('mn-MN', {month: 'short', day: 'numeric'})}</div>}
        <article className={`chat-message ${m.sender === mySender ? 'chat-mine' : 'chat-theirs'}`}>
          <div className="chat-bubble">
            {m.image_url && <button type="button" className="chat-image-button" aria-label="Зургийг томруулж үзэх" onClick={() => setViewImage(m.image_url)}><img src={m.image_url} alt="Илгээсэн зураг" loading="lazy" onLoad={() => {if (scrollEnd.current && list.current) list.current.scrollTop = list.current.scrollHeight;}} /></button>}
            {m.message && <p>{m.message}</p>}
            <div className="chat-meta"><time dateTime={m.created_at}>{new Date(m.created_at).toLocaleTimeString('mn-MN', {hour: '2-digit', minute: '2-digit'})}</time>{m.sender === mySender && <span className={m.read_at ? 'chat-read' : ''}>{m.read_at ? '✓✓ Уншсан' : '✓ Уншаагүй'}</span>}</div>
          </div>
        </article>
      </div>)}
    </div>
    {!atEnd && <button type="button" className="chat-jump" onClick={scrollToEnd}>Сүүлийн мессеж ↓</button>}
    {error && <div className="chat-error" role="alert">{error} <button type="button" onClick={() => void load()}>Дахин ачаалах</button></div>}
    {sendError && <div className="chat-error" role="alert">{sendError}</div>}
    {failed && <div className="chat-failed"><span>{failed.image && '▧ '}{failed.message || 'Зураг'} — илгээсэн нь баталгаажаагүй.</span><button type="button" disabled={sending} onClick={() => void send(failed)}>Дахин илгээх</button><button type="button" disabled={sending} aria-label="Амжилтгүй илгээлтийг хасах" onClick={() => {setFailed(null);setSendError('');}}>✕</button></div>}
    <form className="chat-composer" onSubmit={e => {e.preventDefault(); if (!failed) void send();}} onPaste={e => {
      const file = [...e.clipboardData.files].find(f => f.type.startsWith('image/')); if (file) {e.preventDefault(); void chooseImage(file);}
    }}>
      {image && <div className="chat-attachment"><img src={image} alt="Илгээхээр сонгосон зураг" /><span>Зураг бэлэн</span><button type="button" aria-label="Сонгосон зургийг хасах" onClick={() => setImage(null)}>✕</button></div>}
      <div className="chat-compose-row">
        <input ref={fileInput} hidden type="file" accept="image/jpeg,image/png,image/webp,image/gif" aria-label="Чатанд зураг сонгох" onChange={e => void chooseImage(e.target.files?.[0])} />
        <button type="button" className="chat-icon chat-attach" disabled={preparing || sending || !!failed} onClick={() => fileInput.current?.click()} aria-label="Зураг хавсаргах">＋<span>Зураг</span></button>
        <textarea ref={input} value={text} rows={2} maxLength={2000} aria-label="Мессеж бичих" placeholder={preparing ? 'Зураг бэлтгэж байна…' : 'Мессеж бичих…'} disabled={sending || !!failed} onChange={e => setText(e.target.value)} onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia?.('(pointer: fine)').matches) {e.preventDefault(); if (!failed) void send();}
        }} />
        <button type="submit" className="chat-send" disabled={sending || preparing || !!failed || (!text.trim() && !image)} aria-label="Мессеж илгээх">{sending ? '…' : '↑'}</button>
      </div>
      <div className="chat-compose-note">{preparing ? 'Зургийг бэлтгэж байна…' : 'Зураг хавсаргах эсвэл энд хуулж тавих боломжтой.'}{text.length > 1800 && <span>{text.length}/2000</span>}</div>
    </form>
    {viewImage && <ImageViewer url={viewImage} onClose={() => setViewImage(null)} />}
  </section>;
}

export function AdminChatInbox({announcements}: {announcements?: ReactNode}) {
  const [threads, setThreads] = useState<ChatThread[]>([]), [selected, setSelected] = useState<ChatThread | null>(null);
  const [search, setSearch] = useState(''), [query, setQuery] = useState(''), [offset, setOffset] = useState(0), [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  useEffect(() => { const timer = setTimeout(() => {setQuery(search.trim()); setOffset(0);}, 300); return () => clearTimeout(timer); }, [search]);
  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const result = await requestJson(`/api/chat?inbox=1&q=${encodeURIComponent(query)}&offset=${offset}`, {signal}, true);
      if (!signal?.aborted) {setThreads(result.threads); setMore(result.more); setError('');}
    } catch (e) {if (!signal?.aborted) setError(e instanceof Error ? e.message : 'Чат ачаалсангүй.');}
    finally {if (!signal?.aborted) setLoading(false);}
  }, [query, offset]);
  useChatPoll(load, 10000);
  useEffect(() => {const back = () => setSelected(null); window.addEventListener('adminBackPress', back); return () => window.removeEventListener('adminBackPress', back);}, []);
  return <div className={`admin-chat-layout ${selected ? 'chat-selected' : ''}`}>
    <aside className="chat-inbox"><h2>Хэрэглэгчдийн чат</h2><p>Хариу өгөх харилцан яриагаа сонгоно уу.</p>
      <label className="chat-search"><span>Утас / хэрэглэгчийн дугаар</span><input type="search" inputMode="numeric" placeholder="Дугаараар хайх…" value={search} onChange={e => setSearch(e.target.value.replace(/[^\d #]/g, '').slice(0,30))} /></label>
      {error && <div className="chat-error" role="alert">{error}<button onClick={() => void load()}>Дахин ачаалах</button></div>}
      {loading ? <p className="chat-empty">Ачаалж байна…</p> : !threads.length && !error ? <p className="chat-empty">{query ? 'Тохирох чат олдсонгүй.' : 'Шинэ мессеж энд харагдана.'}</p> : null}
      <div className="chat-thread-list">{threads.map(t => <button type="button" key={t.user_id} className={`chat-thread ${selected?.user_id === t.user_id ? 'chat-thread-selected' : ''}`} onClick={() => setSelected(t)}>
        <span className="chat-avatar" aria-hidden="true">{t.phone.slice(-2)}</span><span className="chat-thread-copy"><strong>{t.phone}</strong><small>{t.sender === 'admin' ? 'Та: ' : ''}{t.has_image ? '▧ ' : ''}{t.message || 'Зураг'}</small></span><ChatBadge count={Number(t.unread)} />
      </button>)}</div>
      {(offset > 0 || more) && <div className="chat-pagination"><button disabled={!offset} onClick={() => setOffset(v => Math.max(0,v-50))}>Өмнөх</button><button disabled={!more} onClick={() => setOffset(v => v+50)}>Дараах</button></div>}
      {announcements && <details className="chat-announcements"><summary>Нийтэд харагдах зар</summary>{announcements}</details>}
    </aside>
    <div className="chat-inbox-detail">{selected ? <ChatPanel key={selected.user_id} admin userId={selected.user_id} title={selected.phone} onBack={() => setSelected(null)} /> : <div className="chat-empty chat-select-prompt"><span aria-hidden="true">💬</span><h3>Хэрэглэгчтэй шууд ярилцаарай</h3><p>Зүүн талаас чат сонгоход мессеж, зураг болон уншсан төлөв харагдана.</p></div>}</div>
  </div>;
}
