const fs = require("fs");
const path = "C:/Users/Nvidia Quadro/mgldrama2/app/page.tsx";
let c = fs.readFileSync(path, "utf8");

// Бүх install box-уудыг устгах
const boxPattern = /\n\s*<div style=\{\{width:'100%',maxWidth:340[^}]+\}\}[\s\S]*?<\/div>\s*<\/div>/g;
c = c.replace(boxPattern, "");

// Буцах товчны өмнө нэг удаа нэмэх (card дотор)
const target = ">Буцах</button>";
const installBox = ">Буцах</button>\n        <div style={{marginTop:12,background:'#0d0d18',borderRadius:12,padding:12,border:'1px solid #e8a020',textAlign:'center'}}>\n          <div style={{fontSize:13,color:'#f0eefa',lineHeight:'1.8'}}>📲 <b>Гар утас дээр суулгах</b><br/><span style={{color:'#6b6a90',fontSize:12}}>Chrome-оор нээгээд</span><br/><span style={{color:'#e8a020',fontWeight:700}}>⋮ цэс - Нүүр дэлгэцэд нэмэх</span></div>\n        </div>";

c = c.replace(target, installBox);
fs.writeFileSync(path, c, "utf8");
console.log("Done:", c.includes("Гар утас"));
