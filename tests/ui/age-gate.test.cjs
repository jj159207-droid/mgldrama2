const assert = require('node:assert/strict');
const { test, beforeEach, afterEach, after } = require('node:test');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const repo = path.resolve(__dirname, '../..');
const dom = new JSDOM('<div id="root"></div>', { url: 'https://taza.site/', pretendToBeVisual: true });
Object.assign(global, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });
const out = path.join(repo, 'node_modules/.cache/age-gate-bundle.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(repo, 'app/components/AgeGate.tsx')], bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', packages: 'external', outfile: out });
const React = require('react'), { act } = React, { createRoot } = require('react-dom/client');
const AgeGate = require(out).default;
let root;
const render = () => act(async () => root.render(React.createElement(AgeGate, null, React.createElement('div', { id: 'site' }, 'SITE CONTENT'))));
const settle = () => act(async () => { await Promise.resolve(); });
beforeEach(() => {
  window.localStorage.clear();
  root = createRoot(document.getElementById('root'));
});
afterEach(async () => { await act(async () => root.unmount()); document.getElementById('root').innerHTML = ''; });
after(() => dom.window.close());

test('site content stays hidden until a visitor confirms they are 21+', async () => {
  await render(); await settle();
  assert.match(document.body.textContent, /Та 21 нас хүрсэн үү/);
  assert.equal(document.querySelector('#site'), null);
  const yes = [...document.querySelectorAll('button')].find(button => /Тийм/.test(button.textContent));
  assert.ok(yes); await act(async () => yes.click());
  assert.equal(window.localStorage.getItem('taza_age_21_v1'), 'yes');
  assert.equal(document.querySelector('#site').textContent, 'SITE CONTENT');
});

test('previous 21+ confirmation opens the site without asking again', async () => {
  window.localStorage.setItem('taza_age_21_v1', 'yes');
  await render(); await settle();
  assert.equal(document.querySelector('#site').textContent, 'SITE CONTENT');
  assert.doesNotMatch(document.body.textContent, /Та 21 нас хүрсэн үү/);
});

test('under-21 choice clears approval and sends the visitor back', async () => {
  window.localStorage.setItem('taza_age_21_v1', 'yes');
  window.localStorage.removeItem('taza_age_21_v1');
  window.history.pushState({}, '', '/from-facebook');
  let backed = 0;
  window.history.back = () => { backed++; };
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
  await render(); await settle();
  const no = [...document.querySelectorAll('button')].find(button => /Үгүй/.test(button.textContent));
  assert.ok(no); await act(async () => no.click());
  assert.equal(backed, 1);
  assert.equal(window.localStorage.getItem('taza_age_21_v1'), null);
});
