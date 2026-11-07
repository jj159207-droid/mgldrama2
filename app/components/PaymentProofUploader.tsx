'use client';

import { useEffect, useRef, useState } from 'react';
import { prepareChatImage } from '@/lib/chat-client';
import { requestJson } from '@/lib/client';

type Prepared = { data: string; name: string; clientId: string };
type State = 'idle' | 'preparing' | 'ready' | 'sending' | 'sent' | 'already-paid';

export default function PaymentProofUploader({
  refCode, amount, ready,
}: {refCode: string; amount: number | null; ready: boolean}) {
  const input = useRef<HTMLInputElement>(null);
  const sending = useRef(false);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    setPrepared(null);
    setState('idle');
    setError('');
  }, [refCode]);

  const choose = async (file?: File) => {
    if (!file || sending.current) return;
    setState('preparing');
    setError('');
    setPrepared(null);
    try {
      const data = await prepareChatImage(file);
      setPrepared({data, name:file.name.slice(0, 80),clientId:crypto.randomUUID()});
      setState('ready');
    } catch (e) {
      setState('idle');
      setError(e instanceof Error ? e.message : 'Зураг бэлтгэж чадсангүй.');
    } finally {
      if (input.current) input.current.value = '';
    }
  };

  const submit = async () => {
    if (!prepared || sending.current || !ready || ![2000,5000,10000,12000].includes(Number(amount))) return;
    sending.current = true;
    setError('');
    setState('sending');
    try {
      const result = await requestJson('/api/payment-proof', {
        method:'POST',
        body:JSON.stringify({ref_code:refCode,client_id:prepared.clientId,image:prepared.data}),
      }, true);
      setPrepared(null);
      setState(result.already_paid ? 'already-paid' : 'sent');
      window.dispatchEvent(new Event('kinoChatChanged'));
    } catch (e) {
      setState('ready');
      setError(e instanceof Error ? e.message : 'Баримт илгээж чадсангүй. Дахин оролдоно уу.');
    } finally {
      sending.current = false;
    }
  };

  return <section className="payment-proof-panel" aria-label="Нэг киноны төлбөрийн баримт илгээх">
    <h3>3. Төлбөрийн screenshot оруулах</h3>
    <p>Та гүйлгээ хийсэн бол банкны апп дээрх <strong>“Гүйлгээ амжилттай”</strong> гэсэн дэлгэцийн зургаа энд оруулна уу.</p>
    <div className="payment-proof-order">
      <span>Дүн <strong>{amount===null ? '…' : `${amount.toLocaleString('mn-MN')}₮`}</strong></span>
      <span>Гүйлгээний код <strong>{ready ? refCode : '…'}</strong></span>
    </div>
    {state==='sent' || state==='already-paid' ? <p className="payment-proof-success" role="status">
      {state==='already-paid'?'✅ Таны төлбөр аль хэдийн баталгаажсан байна. Кино нээгдэнэ.':'✅ Баримт админы чат руу илгээгдлээ. Банкны орлогыг шалгаж байна. Дахин мөнгө шилжүүлэх хэрэггүй.'}
    </p> : <>
      <label className="payment-proof-file">
        <span>📷 {prepared ? 'Өөр зураг сонгох' : 'Гүйлгээний screenshot сонгох'}</span>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={!ready || state==='preparing'||state==='sending'} onChange={e=>{void choose(e.currentTarget.files?.[0]);}}/>
      </label>
      {prepared && <div className="payment-proof-preview">
        <img src={prepared.data} alt="Төлбөрийн баримтын сонгосон зураг" />
        <span>{prepared.name}</span>
      </div>}
      <button type="button" className="primary-button payment-proof-submit" onClick={()=>{void submit();}}
        disabled={!prepared || !ready || ![2000,5000,10000,12000].includes(Number(amount)) || state==='preparing' || state==='sending'}>
        {state==='preparing'?'Зураг бэлтгэж байна…':state==='sending'?'Илгээж байна…':'Баримтаа илгээх'}
      </button>
    </>}
    {error && <p className="payment-proof-error" role="alert">{error}</p>}
    <p className="payment-proof-note">Баримтын зураг дангаараа төлбөр баталдаггүй. Манай дансанд захиалгын яг тохирсон дүн орж, гүйлгээний код таарсныг банкны SMS-ээр баталгаажмагц кино автоматаар нээгдэнэ. SMS ирээгүй бол админ банкны бодит гүйлгээг шалгаж эрх нээнэ.</p>
  </section>;
}
