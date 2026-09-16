import { readFileSync, writeFileSync } from 'node:fs';
const file = 'app/page.tsx';
let text = readFileSync(file, 'utf8');
if (!text.includes('ref={trailerEditorRef}')) {
  const begin = text.indexOf('function EditFilmPanel('), end = text.indexOf('function AdminSettingsTab(', begin);
  if (begin < 0 || end < begin) throw new Error('EditFilmPanel boundary not found; refusing broad patch');
  let panel = text.slice(begin, end);
  function replace(before, after) { if (!panel.includes(before)) throw new Error('Expected movie editor source changed: ' + before); panel = panel.replace(before, after); }
  replace('  const savingRef = useRef(false);', '  const savingRef = useRef(false);\n  const trailerEditorRef = useRef<TrailerEditorHandle>(null);\n  const [trailerBusy, setTrailerBusy] = useState(false);');
  replace('if (savingRef.current || uploading) return;', 'if (savingRef.current || uploading || trailerBusy) return;');
  replace('      const combinedUrl = previewUrl ? `${url}|||${previewUrl}` : url;', '      const nextPreview = (await trailerEditorRef.current?.prepare()) ?? previewUrl;\n      const combinedUrl = nextPreview ? `${url.trim()}|||${nextPreview}` : url.trim();');
  replace('payload.preview_url = previewUrl.trim();', 'payload.preview_url = nextPreview.trim();');
  replace('    } catch(e: any) {\n      alert(', '    } catch(e: any) {\n      if (e?.name === "AbortError") return;\n      alert(');
  replace('      <label style={{ ...lbl, marginTop: 8 }}>Трейлерийн холбоос (богино хэсэг)</label>\n      <input style={inputSt} value={previewUrl} onChange={(e: any) => setPreviewUrl(e.target.value)} placeholder="https://your.b-cdn.net/preview.mp4" />', '      <TrailerEditor ref={trailerEditorRef} filmId={f.id} videoUrl={url} value={previewUrl} onChange={setPreviewUrl} onBusyChange={setTrailerBusy} disabled={saving || uploading} />');
  replace('    <div style={{ marginTop: 10, borderTop:', '    <fieldset disabled={saving || trailerBusy} style={{ minWidth: 0, padding: 0, border: 0, marginTop: 10, borderTop:');
  const close = panel.lastIndexOf('    </div>\n  );');
  if (close < 0) throw new Error('Movie editor closing tag not found');
  panel = panel.slice(0, close) + panel.slice(close).replace('    </div>\n  );', '    </fieldset>\n  );');
  panel = panel.replaceAll('disabled={saving || uploading}', 'disabled={saving || uploading || trailerBusy}');
  panel = panel.replace('<button onClick={onDone}', '<button disabled={saving || uploading || trailerBusy} onClick={onDone}');
  text = text.slice(0, begin) + panel + text.slice(end);
  text = text.replace('import PosterUpload from "@/app/components/PosterUpload";', 'import PosterUpload from "@/app/components/PosterUpload";\nimport TrailerEditor, { type TrailerEditorHandle } from "@/app/components/TrailerEditor";');
  writeFileSync(file, text);
}
let config = readFileSync('next.config.js', 'utf8');
if (!config.includes('serverExternalPackages')) {
  if (!config.includes('  turbopack: {},')) throw new Error('Unexpected next.config.js');
  config = config.replace('  turbopack: {},', "  turbopack: {},\n  serverExternalPackages: ['ffmpeg-static'],\n  outputFileTracingIncludes: { '/api/trailers': ['./node_modules/ffmpeg-static/ffmpeg*'] },");
  writeFileSync('next.config.js', config);
}
