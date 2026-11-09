'use client';
import {useEffect,useState} from 'react';
import {requestJson} from '@/lib/client';
type Member={id:number;user_id:number;full_name:string;age:number;phone:string;payment_id:number;blocked:boolean;created_at:string};
type Message={id:number;memberId:number;text:string;at:string};
export default function SecretChatAdminTab(){
 const [members,setMembers]=useState<Member[]>([]),[messages,setMessages]=useState<Message[]>([]);
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState<number|null>(null),[query,setQuery]=useState('');
 const load=async()=>{const d=await requestJson('/api/secret-chat?admin=1&messages=1',{},true);setMembers(d.members);setMessages(d.messages);};
 useEffect(()=>{let active=true;load().catch(e=>{if(active)setError(e instanceof Error?e.message:'Өрөөний мэдээлэл ачаалсангүй.');}).finally(()=>{if(active)setLoading(false);});const id=setInterval(()=>{if(document.visibilityState!=='hidden')void load().catch(()=>{});},10000);return()=>{active=false;clearInterval(id);};},[]);
 const update=async(member:Member)=>{setBusy(member.id);setError('');try{await requestJson('/api/secret-chat',{method:'PATCH',body:JSON.stringify({memberId:member.id,blocked:!member.blocked})},true);await load();}catch(e){setError(e instanceof Error?e.message:'Өөрчлөлт хадгалагдсангүй.');}finally{setBusy(null);}};
 const remove=async(messageId:number)=>{if(!window.confirm('Энэ зурвасыг устгах уу?'))return;setBusy(messageId);try{await requestJson('/api/secret-chat?messageId='+messageId,{method:'DELETE'},true);await load();}catch(e){setError(e instanceof Error?e.message:'Зурвас устсангүй.');}finally{setBusy(null);}};
 const filtered=members.filter(m=>!query||m.phone.includes(query)||m.full_name.toLowerCase().includes(query.toLowerCase())||String(m.user_id).includes(query));
 return <section className="secret-room-admin">
   <h2>🔥 Нууц чат өрөө — админ</h2>
   <p>10,000₮-ийн төлбөр баталгаажуулсан гишүүдийн утасны дугаар болон зурвасын хяналт.</p>
   {loading&&<p>Ачаалж байна…</p>}{error&&<p role="alert" className="secret-room-error">{error}</p>}
   <label>Нэр эсвэл дугаараар хайх<input type="search" placeholder="Нэр эсвэл 99112233" value={query} maxLength={80} onChange={e=>setQuery(e.target.value.slice(0,80))}/></label>
   <p>Гишүүд: {members.length}</p>
   <div className="secret-room-member-list">{filtered.map(m=><div key={m.id} className="secret-room-admin-card"><strong>Гишүүн #{m.id} · {m.full_name}</strong><span>Нас: {m.age} · Утас: {m.phone}</span><small>Хэрэглэгч #{m.user_id} · Төлбөр #{m.payment_id}</small><button type="button" disabled={busy===m.id} onClick={()=>void update(m)}>{m.blocked?'Эрх сэргээх':'Чатнаас хаах'}</button></div>)}</div>
   <h3>Сүүлийн зурвасууд</h3>
   <div className="secret-room-admin-messages">{messages.map(m=><div key={m.id} className="secret-room-admin-card"><small>Гишүүн #{m.memberId} · {new Date(m.at).toLocaleString('mn-MN')}</small><p>{m.text}</p><button disabled={busy===m.id} type="button" onClick={()=>void remove(m.id)}>Зурвас устгах</button></div>)}</div>
 </section>;
}
