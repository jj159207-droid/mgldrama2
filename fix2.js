const fs = require("fs");
const path = "C:/Users/Nvidia Quadro/mgldrama2/app/page.tsx";
let c = fs.readFileSync(path, "utf8");

// Бүх install box устгах
while (c.includes("Гар утас")) {
  c = c.replace(/\n\s*<div style=\{\{marginTop:12,background:'#0d0d18'[\s\S]*?<\/div>\s*<\/div>/, "");
}

// LoginPage-д л нэмэх - onBack гэсэн props-тай
const loginTarget = ">Буцах</button>\n        <button onClick={onBack}";
const loginNew = ">Буцах</button>\n        <div style={{marginTop:12,background:'#0d0d18',borderRadius:12,padding:12,border:'1px solid #e8a020',textAlign:'center'}}><div style={{fontSize:13,color:'#f0eefa',lineHeight:'1.8'}}>📲 <b>Гар утас дээр суулгах</b><br/><span style={{color:'#6b6a90',fontSize:12}}>Chrome-оор нээгээд</span><br/><span style={{color:'#e8a020',fontWeight:700}}>⋮ цэс - Нүүр дэлгэцэд нэмэх</span></div></div>\n        <button onClick={onBack}";

c = c.replace(loginTarget, loginNew);
fs.writeFileSync(path, c, "utf8");
console.log("Гар утас count:", (c.match(/Гар утас/g)||[]).length);
