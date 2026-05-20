"use client";
import { useState, useRef, useEffect } from "react";

const FILMS_DATA = [
  { id:1,  title:"Алдаанаас төрсөн хайр",    views:120,  op:6000, price:4000, badge:"Хэлтэй", free:false, locked:true,  url:"", img:"", bg:"#1a0820" },
  { id:2,  title:"Нууц их багш",              views:310,  op:6000, price:4000, badge:"Хэлтэй", free:false, locked:true,  url:"", img:"", bg:"#0d1a20" },
  { id:3,  title:"Салалтын Дараах Хаанчлал", views:312,  op:6000, price:4000, badge:"Хэлтэй", free:false, locked:true,  url:"", img:"", bg:"#200a0a" },
  { id:4,  title:"Ялалтын хамтрагч",         views:804,  op:6000, price:4000, badge:"Хадмал", free:false, locked:true,  url:"", img:"", bg:"#101a0d" },
  { id:5,  title:"14 жилийн тангараг",       views:466,  op:6000, price:4000, badge:"Хэлтэй", free:false, locked:true,  url:"", img:"", bg:"#0a0a1a" },
  { id:6,  title:"Нөхрийн өшөө авалт",       views:1275, op:6000, price:0,    badge:"Хадмал", free:true,  locked:false, url:"", img:"", bg:"#121020" },
  { id:7,  title:"Бодол уншдаг хаан",        views:991,  op:6000, price:4000, badge:"Хэлтэй", free:false, locked:true,  url:"", img:"", bg:"#1a1000" },
  { id:8,  title:"Хэвлий дэх дуу",           views:904,  op:6000, price:4000, badge:"Хэлтэй", free:false, locked:true,  url:"", img:"", bg:"#001a10" },
  { id:9,  title:"Үл бөхөх гэрэл",           views:266,  op:6000, price:4000, badge:"Хэлтэй", free:false, locked:true,  url:"", img:"", bg:"#1a1520" },
  { id:10, title:"Үхлээс төрсөн гүнж",       views:1270, op:6000, price:4000, badge:"Хэлтэй", free:false, locked:true,  url:"", img:"", bg:"#200515" },
];

const USERS_DATA = [
  { u:"admin", p:"admin123", name:"Админ",     phone:"97694148719", notif:19, admin:true  },
  { u:"user",  p:"1234",     name:"Хэрэглэгч", phone:"99001234",    notif:2,  admin:false },
];

const C = {
  bg:"#0d0d14", card:"#13131c", card2:"#1a1a26", bd:"#1e1e2e",
  txt:"#f0eefa", muted:"#6b6a90",
  red:"#e8281e", gold:"#e8a020", green:"#16a34a", blue:"#2563eb", amber:"#ca8a04",
};

const badgeColor = (b:string) => b === "Хадмал" ? C.amber : C.blue;

const inputSt:any = {
  width:"100%", background:"#0d0d18", border:`0.5px solid #1e1e2e`,
  borderRadius:8, padding:"11px 13px", color:"#f0eefa", fontSize:14,
  outline:"none", boxSizing:"border-box", fontFamily:"inherit",
};
const goldBtn:any = {
  width:"100%", background:C.gold, border:"none", color:"#000",
  padding:13, borderRadius:10, fontSize:15, fontWeight:700,
  cursor:"pointer", fontFamily:"inherit",
};
const lbl:any = { fontSize:12, color:C.muted, display:"block", marginBottom:5 };
const iconBtn:any = {
  background:"none", border:`0.5px solid #1e1e2e`, borderRadius:7,
  width:34, height:34, fontSize:15, cursor:"pointer",
  display:"flex", alignItems:"center", justifyContent:"center",
};

function QRCanvas({ text }:{ text:string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const S=140, N=21, sz=Math.floor(S/N);
    ctx.fillStyle="#fff"; ctx.fillRect(0,0,S,S);
    ctx.fillStyle="#000";
    const seed = [...text].reduce((a,ch)=>a+ch.charCodeAt(0),0);
    for (let r=0;r<N;r++) for (let c=0;c<N;c++) {
      const v=(r*N+c+seed)%7;
      const corner=(r<7&&c<7)||(r<7&&c>=N-7)||(r>=N-7&&c<7);
      if (corner||v<3) ctx.fillRect(c*sz,r*sz,sz,sz);
    }
    ([[0,0],[0,N-7],[N-7,0]] as number[][]).forEach(([r,c])=>{
      ctx.strokeStyle="#000"; ctx.lineWidth=sz;
      ctx.strokeRect((c+.5)*sz,(r+.5)*sz,6*sz,6*sz);
      ctx.fillRect((c+2)*sz,(r+2)*sz,3*sz,3*sz);
    });
  },[text]);
  return <canvas ref={ref} width={140} height={140} style={{borderRadius:6,display:"block"}} />;
}

function LoginPage({ onLogin }:any) {
  const [u,setU]=useState(""); const [p,setP]=useState(""); const [err,setErr]=useState("");
  const go = () => {
    const found = USERS_DATA.find((x:any)=>x.u===u&&x.p===p);
    if (!found){setErr("Нэр эсвэл нууц үг буруу");return;}
    setErr(""); onLogin(found);
  };
  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"32px 24px"}}>
      <div style={{fontFamily:"Georgia,serif",fontSize:36,fontWeight:800,marginBottom:6}}>
        <span style={{color:C.red}}>MGL</span><span style={{color:C.txt}}> Drama</span>
      </div>
      <p style={{color:C.muted,fontSize:13,marginBottom:36}}>Монгол кино нэг дороо</p>
      <div style={{width:"100%",maxWidth:360}}>
        <label style={lbl}>Нэвтрэх нэр</label>
        <input value={u} onChange={(e:any)=>setU(e.target.value)} placeholder="username" style={inputSt} />
        <label style={{...lbl,marginTop:12}}>Нууц үг</label>
        <input type="password" value={p} onChange={(e:any)=>setP(e.target.value)} placeholder="••••••••" style={inputSt} onKeyDown={(e:any)=>e.key==="Enter"&&go()} />
        {err&&<p style={{color:"#f05555",fontSize:12,marginTop:8}}>{err}</p>}
        <button onClick={go} style={{...goldBtn,marginTop:18}}>Нэвтрэх</button>
        <p style={{color:C.muted,fontSize:12,textAlign:"center",marginTop:14}}>
          Demo: <span style={{color:C.gold}}>user / 1234</span> · Админ: <span style={{color:C.gold}}>admin / admin123</span>
        </p>
      </div>
    </div>
  );
}

function FilmCard({ film, onClick }:any) {
  return (
    <div onClick={onClick} style={{background:C.card,borderRadius:12,overflow:"hidden",cursor:"pointer",border:`0.5px solid ${C.bd}`}}>
      <div style={{position:"relative",aspectRatio:"2/3",overflow:"hidden"}}>
        {film.img
          ? <img src={film.img} alt={film.title} style={{width:"100%",height:"100%",objectFit:"cover"}} />
          : <div style={{width:"100%",height:"100%",background:`linear-gradient(160deg,${film.bg} 0%,#000 100%)`,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <span style={{fontSize:44}}>🎬</span>
            </div>
        }
        <div style={{position:"absolute",top:8,left:8,background:badgeColor(film.badge),borderRadius:5,padding:"2px 8px",fontSize:11,fontWeight:700,color:"#fff"}}>
          {film.badge}
        </div>
      </div>
      <div style={{padding:"10px 10px 14px"}}>
        <div style={{fontSize:13,fontWeight:600,color:C.txt,lineHeight:1.35,marginBottom:8}}>{film.title}</div>
        <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:4}}>
          <span style={{color:C.red,fontSize:10}}>●</span>
          <span style={{fontSize:12,color:C.red}}>{film.views.toLocaleString()} үзсэн</span>
        </div>
        {!film.free&&<div style={{fontSize:11,color:C.muted,textDecoration:"line-through",marginBottom:2}}>{film.op.toLocaleString()}₮</div>}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:6}}>
          <span style={{fontSize:15,fontWeight:700,color:film.free?C.green:C.gold}}>
            {film.free?"Үнэгүй":`${film.price.toLocaleString()}₮`}
          </span>
          {film.free
            ? <button style={{background:C.green,border:"none",color:"#fff",borderRadius:20,padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>▶ Үзэх</button>
            : <button style={{background:C.gold,border:"none",color:"#000",borderRadius:20,padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>💳 Төлбөр</button>
          }
        </div>
      </div>
    </div>
  );
}

function HomePage({ user, films, onFilm, onProfile, onAdmin, onSearch }:any) {
  return (
    <div style={{background:C.bg,minHeight:"100vh",paddingBottom:20}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",background:C.bg,position:"sticky",top:0,zIndex:10}}>
        <div style={{fontFamily:"Georgia,serif",fontSize:22,fontWeight:800}}>
          <span style={{color:C.red}}>MGL</span><span style={{color:C.txt}}> Drama</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <button onClick={onSearch} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:20,lineHeight:1}}>🔍</button>
          <div onClick={onProfile} style={{display:"flex",alignItems:"center",gap:6,background:C.card2,border:`1px solid ${C.bd}`,borderRadius:20,padding:"5px 12px 5px 6px",cursor:"pointer"}}>
            <div style={{width:26,height:26,borderRadius:"50%",background:C.red,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"#fff"}}>
              {user.notif}
            </div>
            <span style={{fontSize:13,color:C.txt}}>{user.phone}</span>
            <span style={{color:C.muted,fontSize:12}}>▾</span>
          </div>
        </div>
      </div>
      {user.admin&&(
        <div style={{padding:"0 14px 12px"}}>
          <button onClick={onAdmin} style={{background:C.red,border:"none",color:"#fff",borderRadius:8,padding:"8px 20px",fontWeight:700,cursor:"pointer",fontSize:13}}>
            ⚙️ Кино удирдах
          </button>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,padding:"0 12px"}}>
        {films.map((f:any)=><FilmCard key={f.id} film={f} onClick={()=>onFilm(f)} />)}
      </div>
    </div>
  );
}

function PayModal({ film, onClose, onConfirm }:any) {
  if (!film) return null;
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",display:"flex",alignItems:"flex-end",zIndex:100}}>
      <div style={{background:C.card,borderRadius:"18px 18px 0 0",padding:"20px 20px 36px",width:"100%",border:`0.5px solid ${C.bd}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
          <div style={{fontSize:16,fontWeight:700,color:C.txt}}>{film.title}</div>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,fontSize:26,cursor:"pointer",lineHeight:1}}>×</button>
        </div>
        <p style={{fontSize:13,color:C.muted,marginBottom:18}}>QPay-ээр төлбөр төлнө үү</p>
        <div style={{background:C.card2,borderRadius:12,padding:16,display:"flex",flexDirection:"column",alignItems:"center",gap:10,marginBottom:16,border:`0.5px solid ${C.bd}`}}>
          <div style={{fontSize:12,color:C.muted,textDecoration:"line-through"}}>{film.op.toLocaleString()}₮</div>
          <div style={{fontSize:28,fontWeight:800,color:C.gold}}>{film.price.toLocaleString()}₮</div>
          <div style={{background:"#fff",borderRadius:8,padding:4}}>
            <QRCanvas text={`qpay:mgldrama:${film.id}:${film.price}`} />
          </div>
          <div style={{fontSize:12,color:C.muted}}>QPay апп-аар уншина уу</div>
        </div>
        <button onClick={onConfirm} style={{width:"100%",background:"#166534",border:"0.5px solid #16a34a",color:"#4ade80",padding:14,borderRadius:10,fontSize:15,fontWeight:700,cursor:"pointer",marginBottom:10}}>
          ✓ Төлбөр хийсэн — Кино үзэх
        </button>
        <button onClick={onClose} style={{width:"100%",background:"none",border:`0.5px solid ${C.bd}`,color:C.muted,padding:12,borderRadius:10,fontSize:14,cursor:"pointer"}}>
          Болих
        </button>
      </div>
    </div>
  );
}

function VideoPage({ film, onBack }:any) {
  const [playing, setPlaying] = useState(false);
  const embed = film.url ? film.url.replace("watch?v=","embed/").replace("youtu.be/","www.youtube.com/embed/") : "";
  return (
    <div style={{background:"#000",minHeight:"100vh"}}>
      <div style={{background:C.card,padding:"14px 16px",display:"flex",alignItems:"center",gap:10}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:C.muted,fontSize:22,cursor:"pointer",lineHeight:1}}>←</button>
        <span style={{fontSize:15,fontWeight:600,color:C.txt}}>{film.title}</span>
      </div>
      <div style={{width:"100%",aspectRatio:"16/9",background:"#000",position:"relative",display:"flex",alignItems:"center",justifyContent:"center"}}>
        {embed
          ? <iframe src={`${embed}${playing?"?autoplay=1":""}`} style={{position:"absolute",inset:0,width:"100%",height:"100%",border:"none"}} allowFullScreen allow="autoplay" />
          : <button onClick={()=>setPlaying(!playing)} style={{width:64,height:64,borderRadius:"50%",background:"rgba(232,160,32,0.9)",border:"none",cursor:"pointer",fontSize:26}}>
              {playing?"⏸":"▶"}
            </button>
        }
      </div>
      <div style={{padding:20}}>
        <div style={{display:"inline-block",background:badgeColor(film.badge),borderRadius:5,padding:"2px 10px",fontSize:11,fontWeight:700,color:"#fff",marginBottom:10}}>{film.badge}</div>
        <div style={{fontFamily:"Georgia,serif",fontSize:22,fontWeight:700,color:C.txt,marginBottom:8}}>{film.title}</div>
        <div style={{display:"flex",alignItems:"center",gap:5}}>
          <span style={{color:C.red,fontSize:10}}>●</span>
          <span style={{fontSize:13,color:C.red}}>{film.views.toLocaleString()} үзсэн</span>
        </div>
      </div>
    </div>
  );
}

function ProfilePage({ user, onBack, onLogout }:any) {
  return (
    <div style={{background:C.bg,minHeight:"100vh"}}>
      <div style={{background:C.card,padding:"14px 16px",display:"flex",alignItems:"center",gap:10,borderBottom:`0.5px solid ${C.bd}`}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:C.muted,fontSize:22,cursor:"pointer"}}>←</button>
        <span style={{fontSize:15,fontWeight:600,color:C.txt}}>Профайл</span>
      </div>
      <div style={{padding:20,textAlign:"center"}}>
        <div style={{width:68,height:68,borderRadius:"50%",background:C.red,margin:"0 auto 12px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,fontWeight:800,color:"#fff"}}>
          {user.name[0]}
        </div>
        <div style={{fontSize:18,fontWeight:700,color:C.txt,marginBottom:4}}>{user.name}</div>
        <div style={{fontSize:13,color:C.muted,marginBottom:24}}>{user.phone}</div>
        {["❤️ Хадгалсан кино","🕐 Үзсэн түүх","⚙️ Тохиргоо"].map((l:string)=>(
          <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"15px 4px",borderBottom:`0.5px solid ${C.bd}`,cursor:"pointer"}}>
            <span style={{fontSize:14,color:C.txt}}>{l}</span>
            <span style={{color:C.muted}}>›</span>
          </div>
        ))}
        <button onClick={onLogout} style={{marginTop:24,width:"100%",background:"none",border:"0.5px solid #3a1a1a",color:"#f05555",padding:13,borderRadius:10,fontSize:14,cursor:"pointer"}}>
          Гарах
        </button>
      </div>
    </div>
  );
}

function SearchPage({ films, onFilm, onBack }:any) {
  const [q,setQ]=useState("");
  const res = q ? films.filter((f:any)=>f.title.toLowerCase().includes(q.toLowerCase())) : [];
  return (
    <div style={{background:C.bg,minHeight:"100vh"}}>
      <div style={{background:C.card,padding:"12px 14px",display:"flex",alignItems:"center",gap:10,borderBottom:`0.5px solid ${C.bd}`}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:C.muted,fontSize:22,cursor:"pointer"}}>←</button>
        <input autoFocus value={q} onChange={(e:any)=>setQ(e.target.value)} placeholder="Кино хайх..." style={{...inputSt,flex:1}} />
      </div>
      <div style={{padding:"12px 14px"}}>
        {q&&res.length===0&&<p style={{color:C.muted,textAlign:"center",marginTop:40}}>Олдсонгүй</p>}
        {res.map((f:any)=>(
          <div key={f.id} onClick={()=>onFilm(f)} style={{display:"flex",gap:12,alignItems:"center",padding:"10px 0",borderBottom:`0.5px solid ${C.bd}`,cursor:"pointer"}}>
            <div style={{width:44,height:60,borderRadius:6,background:f.bg,flexShrink:0,overflow:"hidden"}}>
              {f.img&&<img src={f.img} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} />}
            </div>
            <div>
              <div style={{fontSize:14,fontWeight:600,color:C.txt}}>{f.title}</div>
              <div style={{fontSize:12,color:f.free?C.green:C.gold,marginTop:3}}>{f.free?"Үнэгүй":`${f.price.toLocaleString()}₮`}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminPage({ films, onBack, onAdd, onDelete, onToggleLock }:any) {
  const [show,setShow]=useState(false);
  const empty = {title:"",views:"0",op:"6000",price:"4000",badge:"Хэлтэй",free:false,locked:true,url:"",img:"",bg:"#1a0820"};
  const [form,setForm]=useState<any>(empty);
  const set=(k:string)=>(e:any)=>setForm((f:any)=>({...f,[k]:e.target.value}));
  const setChk=(k:string)=>(e:any)=>setForm((f:any)=>({...f,[k]:e.target.checked}));
  const save=()=>{
    if (!form.title.trim()){alert("Кино нэр оруулна уу");return;}
    onAdd({...form,id:Date.now(),views:parseInt(form.views)||0,op:parseInt(form.op)||6000,price:parseInt(form.price)||0});
    setForm(empty); setShow(false);
  };
  return (
    <div style={{background:C.bg,minHeight:"100vh",paddingBottom:24}}>
      <div style={{background:C.card,padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:`0.5px solid ${C.bd}`}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={onBack} style={{background:"none",border:"none",color:C.muted,fontSize:22,cursor:"pointer"}}>←</button>
          <span style={{fontSize:15,fontWeight:700,color:C.txt}}>Кино удирдлага</span>
        </div>
        <span style={{fontSize:12,color:C.muted}}>{films.length} кино</span>
      </div>
      <div style={{padding:"12px 14px 4px"}}>
        <button onClick={()=>setShow(!show)} style={{...goldBtn,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
          + Шинэ кино нэмэх
        </button>
      </div>
      {show&&(
        <div style={{margin:"10px 14px",background:C.card2,border:`0.5px solid ${C.bd}`,borderRadius:12,padding:16}}>
          <label style={lbl}>Кино нэр *</label>
          <input style={inputSt} value={form.title} onChange={set("title")} placeholder="Кино нэр" />
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:10}}>
            <div><label style={lbl}>Үзсэн тоо</label><input style={inputSt} value={form.views} onChange={set("views")} /></div>
            <div>
              <label style={lbl}>Badge</label>
              <select style={inputSt} value={form.badge} onChange={set("badge")}>
                <option>Хэлтэй</option><option>Хадмал</option>
              </select>
            </div>
            <div><label style={lbl}>Хуучин үнэ ₮</label><input style={inputSt} value={form.op} onChange={set("op")} /></div>
            <div><label style={lbl}>Одоогийн үнэ ₮</label><input style={inputSt} value={form.price} onChange={set("price")} /></div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginTop:10}}>
            <input type="checkbox" id="cb-free" checked={form.free} onChange={setChk("free")} />
            <label htmlFor="cb-free" style={{fontSize:13,color:C.txt}}>Үнэгүй кино</label>
          </div>
          <label style={{...lbl,marginTop:10}}>YouTube URL</label>
          <input style={inputSt} value={form.url} onChange={set("url")} placeholder="https://youtu.be/xxxxx" />
          <label style={{...lbl,marginTop:10}}>Постер зураг URL</label>
          <input style={inputSt} value={form.img} onChange={set("img")} placeholder="https://..." />
          <label style={{...lbl,marginTop:10}}>Арын өнгө</label>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <input type="color" value={form.bg} onChange={set("bg")} style={{width:40,height:34,borderRadius:6,border:"none",cursor:"pointer"}} />
            <input style={{...inputSt,flex:1}} value={form.bg} onChange={set("bg")} />
          </div>
          <button onClick={save} style={{...goldBtn,marginTop:14}}>Хадгалах</button>
          <button onClick={()=>setShow(false)} style={{width:"100%",background:"none",border:`0.5px solid ${C.bd}`,color:C.muted,padding:10,borderRadius:8,fontSize:13,cursor:"pointer",marginTop:8}}>
            Болих
          </button>
        </div>
      )}
      <div style={{padding:"8px 14px"}}>
        {films.map((f:any)=>(
          <div key={f.id} style={{background:C.card,border:`0.5px solid ${C.bd}`,borderRadius:10,padding:12,marginBottom:10,display:"flex",gap:12,alignItems:"center"}}>
            <div style={{width:44,height:60,borderRadius:6,background:f.bg,flexShrink:0,overflow:"hidden"}}>
              {f.img&&<img src={f.img} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} />}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:600,color:C.txt,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.title}</div>
              <div style={{fontSize:11,color:C.muted,marginTop:2}}>{f.badge} · {f.price.toLocaleString()}₮ · {f.locked?"🔒 Төлбөртэй":"🔓 Нээлттэй"}</div>
            </div>
            <div style={{display:"flex",gap:6}}>
              <button onClick={()=>onToggleLock(f.id)} style={iconBtn} title="Түгжэх/нээх">🔒</button>
              <button onClick={()=>{if(window.confirm("Устгах уу?"))onDelete(f.id);}} style={{...iconBtn,color:"#f05555"}} title="Устгах">🗑</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const [page,setPage]=useState("login");
  const [user,setUser]=useState<any>(null);
  const [films,setFilms]=useState<any[]>(FILMS_DATA);
  const [payFilm,setPayFilm]=useState<any>(null);
  const [curFilm,setCurFilm]=useState<any>(null);

  const handleFilm = (f:any) => {
    if (f.free||!f.locked){setCurFilm(f);setPage("video");}
    else setPayFilm(f);
  };
  const confirmPay = () => {
    setFilms((fs:any[])=>fs.map((f:any)=>f.id===payFilm.id?{...f,locked:false}:f));
    setCurFilm({...payFilm,locked:false});
    setPayFilm(null); setPage("video");
  };

  return (
    <div style={{maxWidth:430,margin:"0 auto",fontFamily:"system-ui,sans-serif"}}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}body{background:#0d0d14}input,select,button{font-family:inherit}input:focus,select:focus{outline:none;border-color:#e8a020!important}::-webkit-scrollbar{width:0}`}</style>
      {page==="login"   && <LoginPage   onLogin={(u:any)=>{setUser(u);setPage("home");}} />}
      {page==="home"    && user && <HomePage user={user} films={films} onFilm={handleFilm} onProfile={()=>setPage("profile")} onAdmin={()=>setPage("admin")} onSearch={()=>setPage("search")} />}
      {page==="video"   && curFilm && <VideoPage film={curFilm} onBack={()=>setPage("home")} />}
      {page==="profile" && user && <ProfilePage user={user} onBack={()=>setPage("home")} onLogout={()=>{setUser(null);setPage("login");}} />}
      {page==="admin"   && user?.admin && <AdminPage films={films} onBack={()=>setPage("home")} onAdd={(f:any)=>setFilms((fs:any[])=>[f,...fs])} onDelete={(id:any)=>setFilms((fs:any[])=>fs.filter((f:any)=>f.id!==id))} onToggleLock={(id:any)=>setFilms((fs:any[])=>fs.map((f:any)=>f.id===id?{...f,locked:!f.locked}:f))} />}
      {page==="search"  && <SearchPage films={films} onFilm={handleFilm} onBack={()=>setPage("home")} />}
      {payFilm && <PayModal film={payFilm} onClose={()=>setPayFilm(null)} onConfirm={confirmPay} />}
    </div>
  );
}
