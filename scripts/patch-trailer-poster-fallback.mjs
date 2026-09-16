import fs from 'node:fs';

function replaceOnce(text, oldText, newText, label) {
  const count = text.split(oldText).length - 1;
  if (count !== 1) throw new Error(`${label}: expected 1 anchor, found ${count}`);
  return text.replace(oldText, newText);
}

fs.writeFileSync('app/components/TrailerPosterFrame.tsx', `"use client";\n\nimport { getVideoEmbed, trailerUrl, type FilmDetails } from "@/lib/film-details";\n\ntype Props = {\n  film: Pick<FilmDetails, "preview_url" | "url">;\n  className?: string;\n};\n\nexport default function TrailerPosterFrame({ film, className = "" }: Props) {\n  const { src, type } = getVideoEmbed(trailerUrl(film));\n  if (type !== "video" || !src) return null;\n  const frameSrc = src.includes("#") ? src : src + "#t=0.1";\n  return <video\n    className={"trailer-poster-frame" + (className ? " " + className : "")}\n    src={frameSrc}\n    muted\n    playsInline\n    preload="metadata"\n    aria-hidden="true"\n    tabIndex={-1}\n  />;\n}\n`);

let page=fs.readFileSync('app/page.tsx','utf8');
page=replaceOnce(page,
`import FilmLanding from "@/app/components/FilmLanding";`,
`import FilmLanding from "@/app/components/FilmLanding";\nimport TrailerPosterFrame from "@/app/components/TrailerPosterFrame";`,
'page trailer poster import');
page=replaceOnce(page,
`    {film.img && !failed && <img loading="lazy" decoding="async" width="360" height="540" src={film.img} alt="" onError={() => setFailed(true)} />}\n  </div>;`,
`    {film.img && !failed\n      ? <img loading="lazy" decoding="async" width="360" height="540" src={film.img} alt="" onError={() => setFailed(true)} />\n      : <TrailerPosterFrame film={film} />}\n  </div>;`,
'catalog poster fallback');
fs.writeFileSync('app/page.tsx',page);

let landing=fs.readFileSync('app/components/FilmLanding.tsx','utf8');
landing=replaceOnce(landing,
`import { filmPlans, getVideoEmbed, relatedFilms, trailerUrl, type FilmDetails } from "@/lib/film-details";`,
`import { filmPlans, getVideoEmbed, relatedFilms, trailerUrl, type FilmDetails } from "@/lib/film-details";\nimport TrailerPosterFrame from "@/app/components/TrailerPosterFrame";`,
'landing trailer poster import');
landing=replaceOnce(landing,
`  return src && !failed ? <Image unoptimized src={src} alt={film.title} fill sizes={priority ? "(max-width: 760px) 54vw, 540px" : "(max-width: 760px) 33vw, 360px"} preload={priority} onError={()=>setFailed(true)} />\n    : <span className="detail-poster-fallback" aria-hidden="true"><span>ТАЗА САЙТ</span><strong>{film.title}</strong></span>;`,
`  return src && !failed ? <Image unoptimized src={src} alt={film.title} fill sizes={priority ? "(max-width: 760px) 54vw, 540px" : "(max-width: 760px) 33vw, 360px"} preload={priority} onError={()=>setFailed(true)} />\n    : <><span className="detail-poster-fallback" aria-hidden="true"><span>ТАЗА САЙТ</span><strong>{film.title}</strong></span><TrailerPosterFrame film={film} className="detail-poster-video" /></>;`,
'landing image fallback');
fs.writeFileSync('app/components/FilmLanding.tsx',landing);

let css=fs.readFileSync('app/globals.css','utf8');
css=replaceOnce(css,
`.poster-art,.poster-art>img,.poster-fallback{position:absolute;inset:0;width:100%;height:100%}.poster-art>img{object-fit:cover;transition:transform .35s}`,
`.poster-art,.poster-art>img,.poster-art>.trailer-poster-frame,.poster-fallback{position:absolute;inset:0;width:100%;height:100%}.poster-art>img,.poster-art>.trailer-poster-frame{object-fit:cover;transition:transform .35s}.poster-art>.trailer-poster-frame{border:0;pointer-events:none;background:#141c28}`,
'catalog poster css');
css=replaceOnce(css,
`.movie-main:hover .poster-art>img{transform:scale(1.045)}`,
`.movie-main:hover .poster-art>img,.movie-main:hover .poster-art>.trailer-poster-frame{transform:scale(1.045)}`,
'catalog hover css');
css=replaceOnce(css,
`.detail-poster img{object-fit:cover}`,
`.detail-poster img{object-fit:cover}.detail-poster-video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border:0;pointer-events:none;background:#111822}`,
'detail poster css');
css=replaceOnce(css,
`.related-poster img{object-fit:cover}`,
`.related-poster img{object-fit:cover}.related-poster .detail-poster-video{background:#090d13}`,
'related poster css');
fs.writeFileSync('app/globals.css',css);

fs.writeFileSync('tests/ui/trailer-poster-fallback.test.cjs', `const assert=require('node:assert/strict');\nconst {test}=require('node:test');\nconst fs=require('node:fs');\nconst path=require('node:path');\nconst repo=path.resolve(__dirname,'../..');\nconst read=p=>fs.readFileSync(path.join(repo,p),'utf8');\n\ntest('missing poster uses only the public trailer first frame on catalog and detail views',()=>{\n  const frame=read('app/components/TrailerPosterFrame.tsx');\n  const page=read('app/page.tsx');\n  const landing=read('app/components/FilmLanding.tsx');\n  assert.match(frame,/getVideoEmbed\\(trailerUrl\\(film\\)\\)/);\n  assert.match(frame,/type !== "video"/);\n  assert.match(frame,/#t=0\\.1/);\n  assert.match(frame,/preload="metadata"/);\n  assert.match(page,/: <TrailerPosterFrame film=\\{film\\} \\/>/);\n  assert.match(landing,/<TrailerPosterFrame film=\\{film\\} className="detail-poster-video" \\/>/);\n  assert.doesNotMatch(frame,/film\\.url\\?\\.split/);\n});\n\ntest('uploaded image stays preferred and trailer frame is decorative only',()=>{\n  const frame=read('app/components/TrailerPosterFrame.tsx');\n  const page=read('app/page.tsx');\n  assert.match(page,/film\\.img && !failed[\\s\\S]*\\? <img[\\s\\S]*: <TrailerPosterFrame/);\n  assert.match(frame,/muted/);\n  assert.match(frame,/playsInline/);\n  assert.match(frame,/tabIndex=\\{-1\\}/);\n  assert.match(frame,/aria-hidden="true"/);\n});\n`);
console.log('Trailer poster first-frame fallback applied.');
