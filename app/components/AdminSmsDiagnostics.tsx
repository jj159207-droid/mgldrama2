'use client';
import {useState} from 'react';

interface SmsEvent {
 time: string;
 ref: string;
 outcome: string;
 amount: number|null;
 detail: string;
}
interface Pending {
 ref: string;
 amount: number;
 plan: string;
 createdAt: string;
}
interface SmsReport {
 smsEventsAvailable: boolean;
 events: SmsEvent[];
 recentPending: Pending[];
 advice: string;
}

const label:Record<string,string>={
 confirmed:'Эрх баталгаажсан',
 wallet_confirmed:'Үлдэгдэл нэмэгдсэн',
 already_confirmed:'Өмнө баталгаажсан',
 parse_failed:'SMS-ийн дүн эсвэл 6 оронтой код танигдсангүй',
 sender_rejected:'Банкны SMS илгээгч таараагүй',
 sender_not_configured:'Банкны SMS илгээгчийн тохиргоо дутуу',
 payment_not_found:'Гүйлгээний кодтой захиалга олдсонгүй',
 amount_mismatch:'Дүн захиалгатай таараагүй',
 payment_expired:'Захиалгын хугацаа дууссан',
 payment_not_pending:'Захиалгын төлөв тохироогүй',
 amount_rejected:'Төлбөрийн дүн буруу',
 server_error:'Серверийн алдаа',
 state_changed:'Захиалгын төлөв өөрчлөгдсөн',
};

export default function AdminSmsDiagnostics() {
 const [report,setReport]=useState<SmsReport|null>(null);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(false);

 const load=async()=>{
  setLoading(true);setError('');
  try {
   const response=await fetch('/api/admin/sms-diagnostics',{credentials:'same-origin',cache:'no-store',headers:{'X-Taza-Site':'taza'}});
   const data:SmsReport & {message?:string}=await response.json();
   if(!response.ok)throw new Error(data.message||'SMS шалгалт амжилтгүй.');
   setReport(data);
  }catch(e){setError(e instanceof Error?e.message:'SMS шалгалтыг уншиж чадсангүй.');}
  finally{setLoading(false);}
 };

 return <section style={{border:'1px solid #334155',background:'#101820',padding:14,borderRadius:12,marginBottom:12,color:'#f8fafc'}}>
  <div style={{fontWeight:800,fontSize:14,marginBottom:8}}>📩 MacroDroid ба SMS төлбөрийн шалгалт</div>
  <p style={{color:'#cbd5e1',fontSize:12,lineHeight:1.55,marginBottom:10}}>Мөнгө шилжүүлсэн боловч кино нээгдээгүй бол SMS серверт ирсэн эсэх, захиалга хүлээгдэж байгаа эсэхийг шалгана. Дахин шилжүүлэхгүй.</p>
  <button type="button" disabled={loading} onClick={()=>void load()} style={{border:'none',borderRadius:9,padding:'12px 14px',background:'#fbbf24',color:'#111827',fontWeight:800,cursor:'pointer',width:'100%'}}>
   {loading?'Шалгаж байна…':'SMS ба төлбөрийн төлөв шалгах'}
  </button>
  {error&&<p role="alert" style={{color:'#fca5a5',fontSize:12,marginTop:9}}>{error}</p>}
  {report&&<div style={{marginTop:14}}>
   {!report.smsEventsAvailable&&<p role="alert" style={{fontSize:12,color:'#fbbf24'}}>SMS үйл явдлын бүртгэлийн хүснэгт уншигдсангүй. SMS-ийн үйл явдлыг бүртгэх SQL тохиргоог шалгана.</p>}
   <strong style={{fontSize:12}}>Сүүлийн SMS үйл явдал ({report.events?.length||0})</strong>
   {report.events?.length?report.events.slice(0,15).map((ev,i)=><div key={i} style={{fontSize:12,borderTop:'1px solid #334155',padding:'8px 0'}}>
    <strong>{label[ev.outcome]||ev.outcome}</strong>
    <div style={{color:'#cbd5e1',fontSize:11,overflowWrap:'anywhere'}}>{ev.ref?'Код: '+ev.ref+' · ':''}{ev.amount!==null?Number(ev.amount).toLocaleString('mn-MN')+'₮ · ':''}{ev.time?new Date(ev.time).toLocaleString('mn-MN'):''}</div>
   </div>):<p style={{fontSize:11,color:'#94a3b8',marginTop:5}}>SMS лог одоогоор харагдахгүй байна. MacroDroid SMS дамжуулаагүй, эсвэл логийн хүснэгт байхгүй байж болно.</p>}
   <strong style={{fontSize:12,display:'block',marginTop:14}}>Хүлээгдэж буй захиалга ({report.recentPending?.length||0})</strong>
   {report.recentPending?.length?report.recentPending.slice(0,15).map((p,i)=><div key={i} style={{padding:'7px 0',fontSize:12,borderTop:'1px solid #334155'}}>
    <strong>{p.ref}</strong> · {Number(p.amount).toLocaleString('mn-MN')}₮ <span style={{color:'#94a3b8',fontSize:11}}>{p.createdAt?new Date(p.createdAt).toLocaleString('mn-MN'):''}</span>
   </div>):<p style={{fontSize:11,color:'#94a3b8',marginTop:5}}>Хүлээгдэж буй захиалга харагдахгүй байна.</p>}
   <p style={{fontSize:11,color:'#fbbf24',lineHeight:1.55,marginTop:12}}>Банкны бодит орлого, дүн, код таарсан бол Админ → Захиалга хэсгээс зөвхөн тэр захиалгыг баталгаажуулж болно.</p>
  </div>}
 </section>;
}
