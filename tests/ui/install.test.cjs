const assert = require('node:assert/strict');
const { test, beforeEach, afterEach, after } = require('node:test');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const repo = path.resolve(__dirname, '../..');
const bootstrap = readFileSync(path.join(repo, 'public/install.js'), 'utf8');
const dom = new JSDOM('<div id="root"></div>', { url: 'https://taza.site/?film=33', pretendToBeVisual: true, runScripts: 'outside-only' });
Object.assign(global, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Event: dom.window.Event, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true });
dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };
dom.window.eval(bootstrap);
const out = path.join(repo, 'node_modules/.cache/install-bundle.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(repo, 'app/components/AppInstallButton.tsx')], bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', packages: 'external', alias: { '@/lib': path.join(repo, 'lib') }, outfile: out });
const React = require('react'), { act } = React, { createRoot } = require('react-dom/client');
const AppInstallButton = require(out).default;
let root, standalone, display, copied;
function agent(ua, touch = 0) {
  Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
  Object.defineProperty(navigator, 'maxTouchPoints', { value: touch, configurable: true });
}
beforeEach(() => {
  root = createRoot(document.getElementById('root'));
  standalone = false; copied = [];
  Object.assign(window.__kinoPwa, { prompt: null, installed: false, prompting: false });
  agent('Mozilla/5.0 (Linux; Android 14) Chrome/140.0 Mobile Safari/537.36');
  Object.defineProperty(navigator, 'standalone', { value: false, configurable: true });
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: async value => copied.push(value) }, configurable: true });
  display = new dom.window.EventTarget();
  Object.defineProperty(display, 'matches', { get: () => standalone });
  window.matchMedia = () => display;
});
afterEach(async () => { await act(async () => root.unmount()); });
after(() => dom.window.close());
const render = () => act(async () => root.render(React.createElement(AppInstallButton)));
const click = selector => act(async () => { const el = document.querySelector(selector); assert.ok(el, selector); el.click(); });
const trigger = () => click('.app-install-trigger');
function nativePrompt(outcome = 'dismissed', implementation) {
  const event = new dom.window.Event('beforeinstallprompt', { cancelable: true });
  let calls = 0;
  event.prompt = () => { calls++; return implementation ? implementation() : Promise.resolve(); };
  event.userChoice = Promise.resolve({ outcome });
  window.dispatchEvent(event);
  assert.equal(event.defaultPrevented, true);
  return { event, calls: () => calls };
}

test('a pre-hydration prompt is called immediately on click exactly once, and acceptance does not falsely claim installation', async () => {
  const prompt = nativePrompt('accepted');
  await render();
  await act(async () => {
    document.querySelector('.app-install-trigger').click();
    assert.equal(prompt.calls(), 1, 'prompt remains inside the user click');
  });
  assert.match(document.querySelector('[role="status"]').textContent, /хүсэлтийг зөвшөөрлөө/);
  assert.equal(document.querySelector('.app-install-trigger').textContent.trim(), 'Апп суулгах');
  await click('.install-close'); await trigger(); assert.equal(prompt.calls(), 1);
  await act(async () => window.dispatchEvent(new Event('appinstalled')));
  assert.match(document.body.textContent, /Апп бэлэн байна/);
  assert.equal(document.querySelector('.app-install-trigger').textContent.trim(), 'Апп суусан');
});
test('dismissed prompts are consumed; a new browser event enables a fresh install', async () => {
  const first = nativePrompt(); await render(); await trigger();
  assert.match(document.body.textContent, /Суулгалтыг цуцаллаа/);
  await click('.install-close'); await trigger(); assert.equal(first.calls(), 1);
  let second; await act(async () => { second = nativePrompt(); });
  await click('.install-primary'); assert.equal(second.calls(), 1);
});
test('an event arriving after the instructions opened enables native installation', async () => {
  await render(); await trigger(); assert.match(document.body.textContent, /Chrome цэсээр суулгах/);
  let prompt; await act(async () => { prompt = nativePrompt(); });
  assert.ok(document.querySelector('.install-primary'));
  await click('.install-primary'); assert.equal(prompt.calls(), 1);
});
test('double clicks cannot consume the same prompt twice while the system dialog is pending', async () => {
  let finish;
  const prompt = nativePrompt('dismissed', () => new Promise(resolve => { finish = resolve; }));
  await render(); await trigger(); await trigger(); assert.equal(prompt.calls(), 1);
  assert.equal(document.querySelector('.app-install-trigger').getAttribute('aria-busy'), 'true');
  await act(async () => finish()); assert.equal(document.querySelector('.app-install-trigger').getAttribute('aria-busy'), 'false');
});
test('if the native dialog never responds, users can reopen help and use manual installation without a second prompt', async () => {
  const prompt = nativePrompt('dismissed', () => new Promise(() => {}));
  await render(); await trigger(); await click('.install-close'); await trigger(); await click('.install-help');
  assert.equal(prompt.calls(), 1);
  assert.match(document.body.textContent, /Chrome цэсээр суулгах/);
  assert.ok(document.querySelector('.install-copy'));
});
for (const kind of ['sync', 'async']) test(`${kind} prompt errors recover to manual instructions without an unhandled failure`, async () => {
  const prompt = nativePrompt('dismissed', () => { if (kind === 'sync') throw Error('not allowed'); return Promise.reject(Error('not allowed')); });
  await render(); await trigger(); assert.equal(prompt.calls(), 1);
  assert.match(document.body.textContent, /Суулгах цонх нээгдсэнгүй/);
  assert.match(document.body.textContent, /Chrome цэсээр суулгах/);
  assert.equal(document.querySelector('.app-install-trigger').disabled, false);
});
test('iPhone instructions use Safari Share, Add to Home Screen and Open as Web App', async () => {
  agent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile/15E148 Safari/604.1');
  await render(); await trigger();
  assert.match(document.body.textContent, /Safari дээр 3 алхам/);
  assert.match(document.body.textContent, /Open as Web App/);
  assert.doesNotMatch(document.body.textContent, /Chrome цэсээр суулгах/);
});
test('iPad with a desktop user agent receives iOS instructions', async () => {
  agent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Version/18.0 Safari/605.1', 5);
  await render(); await trigger(); assert.match(document.body.textContent, /Safari дээр 3 алхам/);
});
test('Facebook on iPhone guides opening Safari, copies only the public origin, and never tries an embedded install', async () => {
  agent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) [FBAN/FBIOS;FBAV/500.0]');
  const prompt = nativePrompt(); await render(); await trigger(); assert.equal(prompt.calls(), 0);
  assert.match(document.body.textContent, /Open in Safari/);
  await click('.install-copy button'); assert.deepEqual(copied, ['https://taza.site/']);
  assert.match(document.body.textContent, /Холбоос хууллаа/);
});
test('Android embedded webviews guide opening an external browser', async () => {
  agent('Mozilla/5.0 (Linux; Android 14; Pixel; wv) AppleWebKit/537.36 Version/4.0 Chrome/140 Mobile');
  await render(); await trigger(); assert.match(document.body.textContent, /Open in browser/);
});
test('blocked clipboard leaves a selectable link and manual copy instructions', async () => {
  navigator.clipboard.writeText = async () => { throw Error('denied'); };
  await render(); await trigger(); await click('.install-copy button');
  const input = document.querySelector('.install-copy input');
  assert.equal(document.activeElement, input); assert.equal(input.selectionEnd, input.value.length);
  assert.match(document.body.textContent, /удаан дараад хуулна/);
});
test('standalone apps show installed state, including changes while the page is open', async () => {
  await render(); standalone = true;
  await act(async () => display.dispatchEvent(new Event('change')));
  let prompt; await act(async () => { prompt = nativePrompt(); });
  await trigger(); assert.equal(prompt.calls(), 0);
  assert.match(document.body.textContent, /Апп бэлэн байна/);
});
test('legacy iOS standalone is recognized and Escape restores focus and scrolling', async () => {
  Object.defineProperty(navigator, 'standalone', { value: true, configurable: true });
  await render(); await trigger(); assert.match(document.body.textContent, /Апп бэлэн байна/);
  assert.equal(document.body.style.overflow, 'hidden');
  await act(async () => document.querySelector('dialog').dispatchEvent(new Event('cancel', { cancelable: true })));
  assert.equal(document.querySelector('dialog'), null);
  assert.equal(document.body.style.overflow, '');
  assert.equal(document.activeElement, document.querySelector('.app-install-trigger'));
});
test('desktop fallback does not show phone-specific instructions', async () => {
  agent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140 Safari/537.36');
  await render(); await trigger(); assert.match(document.body.textContent, /Chrome эсвэл Edge/);
  assert.doesNotMatch(document.body.textContent, /Safari дээр 3 алхам|Chrome цэсээр суулгах/);
});
test('the bootstrap handles already loaded pages and is idempotent', async () => {
  const page = new JSDOM('', { url: 'https://taza.site', runScripts: 'outside-only' });
  const registrations = [];
  Object.defineProperty(page.window.document, 'readyState', { value: 'complete' });
  Object.defineProperty(page.window.navigator, 'serviceWorker', { value: { register: async (...args) => registrations.push(args) } });
  try {
    page.window.eval(bootstrap); page.window.eval(bootstrap);
    assert.deepEqual(JSON.parse(JSON.stringify(registrations)), [['/sw.js', { updateViaCache: 'none' }]]);
  } finally { page.window.close(); }
});
