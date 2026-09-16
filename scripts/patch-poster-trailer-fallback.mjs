import fs from 'node:fs';

function replaceByRegex(path, pattern, replacement, label) {
  let text=fs.readFileSync(path,'utf8');
  const matches=[...text.matchAll(pattern)];
  if(matches.length!==1) throw new Error(`${label}: expected 1 match, found ${matches.length}`);
  text=text.replace(pattern,replacement);
  fs.writeFileSync(path,text);
}

replaceByRegex('app/page.tsx',/function Poster\(\{ film \}: any\) \{[\s\S]*?\n\}\nfunction FilmCard/,`function Poster({ film }: any) {
  const [failed, setFailed] = useState(false);
  const [trailerFailed, setTrailerFailed] = useState(false);
  const [trailerVisible, setTrailerVisible] = useState(() => typeof window !== "undefined" && typeof window.IntersectionObserver === "undefined");
  const trailerHost = useRef<HTMLDivElement | null>(null);
  const image = safeUrl(film.img || "", true);
  const trailer = safeUrl(film.preview_url || "");
  const showImage = !!image && !failed;
  const showTrailer = !showImage && !!trailer && !trailerFailed;
  useEffect(() => {
    if(!showTrailer)return;
    const node=trailerHost.current;
    if(!node)return;
    if(typeof window.IntersectionObserver === "undefined") { setTrailerVisible(true); return; }
    const observer=new window.IntersectionObserver(entries=>setTrailerVisible(entries.some(entry=>entry.isIntersecting)),{rootMargin:"180px 0px"});
    observer.observe(node);
    return()=>observer.disconnect();
  },[showTrailer,trailer]);
  return <div className="poster-art" ref={trailerHost}>
    <div className="poster-fallback" aria-hidden="true">
      <span className="poster-wordmark">ТАЗА САЙТ</span>
      <strong>{film.title}</strong>
      <span>{decodeCat(film.badge)} · {decodeBadge(film.badge)}</span>
    </div>
    {showImage && <img loading="lazy" decoding="async" width="360" height="540" src={image} alt="" onError={() => setFailed(true)} />}
    {showTrailer && trailerVisible && <video data-poster-trailer src={trailer} autoPlay muted loop playsInline preload="metadata" aria-hidden="true" tabIndex={-1} onError={()=>setTrailerFailed(true)} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}} />}
  </div>;
}
function FilmCard`,`catalog Poster');

let landing=fs.readFileSync('app/components/FilmLanding.tsx','utf8');
landing=landing.replace('import { useState, type ReactNode } from "react";','import { useState, type ReactNode } from "react";');
const filmImagePattern=/function FilmImage\(\{film, priority = false\}: \{film:FilmDetails; priority\?:boolean\}\) \{[\s\S]*?\n\}\n\nfunction Trailer/;
const matches=[...landing.matchAll(filmImagePattern)];
if(matches.length!==1) throw new Error(`FilmImage: expected 1 match, found ${matches.length}`);
landing=landing.replace(filmImagePattern,`function FilmImage({film, priority = false}: {film:FilmDetails; priority?:boolean}) {
  const [failed, setFailed] = useState(false);
  const [trailerFailed, setTrailerFailed] = useState(false);
  const src = safeUrl(film.img || "", true);
  const embed = getVideoEmbed(trailerUrl(film));
  const trailer = embed.type === "video" ? safeUrl(embed.src) : "";
  // When no poster exists, use only the public trailer as visual media. Never use the private full movie URL.
  return src && !failed ? <Image unoptimized src={src} alt={film.title} fill sizes={priority ? "(max-width: 760px) 54vw, 540px" : "(max-width: 760px) 33vw, 360px"} preload={priority} onError={()=>setFailed(true)} />
    : trailer && !trailerFailed ? <video data-poster-trailer src={trailer} autoPlay muted loop playsInline preload="metadata" aria-hidden="true" tabIndex={-1} onError={()=>setTrailerFailed(true)} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}} />
    : <span className="detail-poster-fallback" aria-hidden="true"><span>ТАЗА САЙТ</span><strong>{film.title}</strong></span>;
}

function Trailer`);
fs.writeFileSync('app/components/FilmLanding.tsx',landing);

const testPath='tests/ui/movie-details.test.cjs';
let test=fs.readFileSync(testPath,'utf8');
const anchor=`test('poster starts only the public trailer; full playback requires its own button',async()=>{`;
if(!test.includes(anchor)) throw new Error('movie-details anchor missing');
const addition=`test('a movie without a poster uses its public trailer in poster areas without requesting full playback',async()=>{\n await render('/?film=34');\n let preview=document.querySelector('.detail-poster video[data-poster-trailer]');assert.ok(preview);assert.equal(preview.getAttribute('src'),films[1].preview_url);assert.equal(preview.muted,true);\n assert.equal(requests.filter(r=>r.path==='/api/playback').length,0);\n await pop('/');\n const card=[...document.querySelectorAll('.movie-main')].find(button=>button.textContent.includes('Алсын зам'));assert.ok(card);\n preview=card.querySelector('video[data-poster-trailer]');assert.ok(preview);assert.equal(preview.getAttribute('src'),films[1].preview_url);\n assert.equal(requests.filter(r=>r.path==='/api/playback').length,0);\n});\n`;
test=test.replace(anchor,addition+anchor);
fs.writeFileSync(testPath,test);
console.log('Applied trailer-as-poster fallback and regression coverage.');
