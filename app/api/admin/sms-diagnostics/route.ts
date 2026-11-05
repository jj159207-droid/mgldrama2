import { NextRequest } from 'next/server';
import { ApiError, db, fail, json, requestSite, session } from '@/lib/server';

export const runtime='nodejs';
export const dynamic='force-dynamic';

// Read-only, private diagnostics; never expose raw SMS, webhook bearer keys,
// payment customer phone numbers, or the complete underlying tables.
export async function GET(req:NextRequest) {
  try {
    if(requestSite(req)!=='taza')throw new ApiError(404,'TAZA SMS шалгалт зөвхөн TAZA-д ажиллана.');
    const s=await session(req);
    if(!s?.admin || !s.masterAdmin)throw new ApiError(403,'Үндсэн админы эрх шаардлагатай.');
    const result:{
      smsEventsAvailable:boolean;
      events:Array<{time:string;ref:string;outcome:string;amount:number|null;detail:string}>;
      recentPending:Array<{ref:string;amount:number;plan:string;createdAt:string}>;
      advice:string;
    }={
      smsEventsAvailable:true,
      events:[],
      recentPending:[],
      advice:'Хэрэв SMS үйл явдал алга бол MacroDroid-ийн SMS зөвшөөрөл, банкны SMS илгээгч, интернет, логийг шалгана. Банканд орсон бодит гүйлгээг баталгаажуулсны дараа захиалгыг админаар нээж болно.'
    };
    try {
      const events=await db('sms_webhook_events?select=created_at,ref_code,outcome,amount,detail&order=created_at.desc&limit=30');
      result.events=events.map(e=>({
        time:String(e.created_at||''),
        ref:String(e.ref_code||''),
        outcome:String(e.outcome||''),
        amount:Number.isSafeInteger(Number(e.amount))?Number(e.amount):null,
        detail:String(e.detail||'').slice(0,160)
      }));
    } catch {
      result.smsEventsAvailable=false;
    }
    try {
      const rows=await db('pending_payments?site_id=eq.taza&status=eq.pending&select=ref_code,amount,plan,created_at&order=created_at.desc&limit=30');
      result.recentPending=rows.map(p=>({
        ref:String(p.ref_code||''),
        amount:Number(p.amount||0),
        plan:String(p.plan||''),
        createdAt:String(p.created_at||'')
      }));
    }catch {
      throw new ApiError(502,'Хүлээгдэж буй захиалгуудын жагсаалтыг авах боломжгүй байна.');
    }
    return json(result);
  } catch(error) {return fail(error);}
}
