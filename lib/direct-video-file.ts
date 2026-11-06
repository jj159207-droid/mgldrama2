// Filenames for a browser-initiated save must be safe on Windows, macOS,
// Android and iOS. The file is a plain MP4, NOT an encrypted/DRM copy.
export function directMovieFileName(title: string): string {
  const cleaned=String(title||'Кино')
    .replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g,' ')
    .replace(/\s+/g,' ')
    .replace(/[. ]+$/g,'')
    .trim()
    .slice(0,90)
    .trim()||'Кино';
  const base=/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(cleaned)?`Кино ${cleaned}`:cleaned;
  return `${base} - TAZA SITE.mp4`;
}

export function isDirectMp4Response(response:Response): boolean {
  if(!response.ok || response.type==='opaque' || !response.body)return false;
  const type=(response.headers.get('content-type')||'').split(';')[0].toLowerCase().trim();
  return type==='video/mp4' || type==='video/x-m4v' || type==='application/octet-stream';
}
