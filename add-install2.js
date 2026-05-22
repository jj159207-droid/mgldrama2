const fs = require("fs");
const path = "C:/Users/Nvidia Quadro/mgldrama2/app/page.tsx";
let c = fs.readFileSync(path, "utf8");

const searchText = ">Буцах</button>";
const installBox = ">Буцах</button>\n      <div style={{width:'100%',maxWidth:340,marginTop:10,background:'#0d0d18',borderRadius:14,padding:14,border:'1px solid #e8a020',textAlign:'center'}}>\n        <div style={{fontSize:13,color:'#f0eefa',lineHeight:'1.9'}}>\n          <span>📲</span> <b>Гар утас дээр суулгах</b><br/>\n          <span style={{color:'#6b6a90',fontSize:12}}>Chrome-оор нээгээд</span><br/>\n          <span style={{color:'#e8a020',fontWeight:700}}>⋮ цэс - Нүүр дэлгэцэд нэмэх</span>\n        </div>\n      </div>";

c = c.replace(searchText, installBox);
fs.writeFileSync(path, c, "utf8");
console.log("Done:", c.includes("Гар утас"));
