// Optional: existing PNG icons are included. No native Cairo dependency.
async function main(){
  const {default:sharp}=await import('sharp');
  for(const size of [192,512]){
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="#0d0d14"/><path d="M30 25h10v23l23-23h14L50 52l28 23H62L40 55v20H30z" fill="#e8a020"/></svg>`;
    await sharp(Buffer.from(svg)).png().toFile(`public/icon-${size}.png`);
  }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
