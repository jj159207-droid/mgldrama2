const fs = require("fs");
const path = "C:/Users/Nvidia Quadro/mgldrama2/app/page.tsx";
let c = fs.readFileSync(path, "utf8");

const old = `<button onClick={onBack} style={{width:"100%",background:"none",border:\`0.5px solid \${C.bd}\`,color:C.muted,padding:11,borderRadius:10,fontSize:13,cursor:"pointer",marginTop:8}}>Буцах</button>`;

const newCode = old + `
      <div style={{width:"100%",maxWidth:340,marginTop:10,background:"#0d0d18",borderRadius:14,padding:14,border:"1px solid #e8a020",textAlign:"center"}}>
        <div style={{fontSize:13,color:"#f0eefa",lineHeight:"1.9"}}>
          <span style={{fontSize:16}}>📲</span> <b>Гар утас дээр суулгах</b><br/>
          <span style={{color:"#6b6a90",fontSize:12}}>Chrome-оор нээгээд</span><br/>
          <span style={{color:"#e8a020",fontWeight:700}}>⋮ цэс {">"} Нүүр дэлгэцэд нэмэх</span>
        </div>
      </div>`;

c = c.replace(old, newCode);
fs.writeFileSync(path, c, {encoding:"utf8"});
console.log("Done!");
