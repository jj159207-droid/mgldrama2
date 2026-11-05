import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf8');

test('public TAZA subscription banners do not mention internal SMS automation tooling', () => {
  const home = source('../app/page.tsx');
  const tuning = source('../app/components/CatalogCardTuning.tsx');
  assert.ok(home.includes('30 хоног үзэх эрх'));
  assert.ok(tuning.includes('30 хоног үзэх эрх'));
  for (const text of [home.split('function HomePage(')[1]?.split('function VideoPage(')[0] || '', tuning]) {
    assert.doesNotMatch(text, /macrodroid|макродроид|макродриод/i);
  }
});
