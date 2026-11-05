import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { isR2MovieReference, r2MovieObjectKey, signR2PlaybackUrl } from '../lib/r2';

test('R2 references are limited to the private movie bucket and playable files', () => {
  assert.equal(isR2MovieReference('r2://taza-movies/films/001.mp4'), true);
  assert.equal(r2MovieObjectKey('r2://taza-movies/films/001.mp4'), 'films/001.mp4');
  assert.equal(isR2MovieReference('r2://taza-movies/movies/a.webm'), true);
  for (const value of [
    'https://example.com/film.mp4',
    'r2://another-bucket/movie.mp4',
    'r2://taza-movies/../private.mp4',
    'r2://taza-movies/folder//movie.mp4',
    'r2://taza-movies/folder/./movie.mp4',
    'r2://taza-movies/file.m3u8',
    'r2://taza-movies/file.mp4?token=123',
    'r2://taza-movies/%2e%2e/secret.mp4',
  ]) assert.equal(isR2MovieReference(value), false, value);
});

test('R2 GET links use temporary AWS v4 signatures and do not expose API secrets', () => {
  const previous = {
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
  };
  try {
    process.env.R2_ACCOUNT_ID = 'a'.repeat(32);
    process.env.R2_ACCESS_KEY_ID = 'SAMPLEACCESS123456';
    process.env.R2_SECRET_ACCESS_KEY = 'EXAMPLE_PRIVATE_TEST_SECRET';
    const now = new Date('2026-11-05T07:00:00.000Z');
    const one = signR2PlaybackUrl('r2://taza-movies/films/movie-01.mp4', now);
    const two = signR2PlaybackUrl('r2://taza-movies/films/movie-01.mp4', now);
    assert.equal(one, two);
    assert.ok(one.startsWith('https://' + 'a'.repeat(32) + '.r2.cloudflarestorage.com/taza-movies/films/movie-01.mp4?'));
    const url = new URL(one);
    assert.equal(url.searchParams.get('X-Amz-Algorithm'), 'AWS4-HMAC-SHA256');
    assert.equal(url.searchParams.get('X-Amz-Date'), '20261105T070000Z');
    assert.equal(url.searchParams.get('X-Amz-Expires'), '14400');
    assert.equal(url.searchParams.get('X-Amz-SignedHeaders'), 'host');
    assert.match(url.searchParams.get('X-Amz-Credential') || '', /\/20261105\/auto\/s3\/aws4_request$/);
    assert.match(url.searchParams.get('X-Amz-Signature') || '', /^[0-9a-f]{64}$/);
    assert.equal(one.includes('EXAMPLE_PRIVATE_TEST_SECRET'), false);
  } finally {
    for (const [k, v] of Object.entries(previous)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});

test('R2 links fail closed if privileged server-only credentials are absent', () => {
  const previous = {
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
  };
  try {
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    assert.throws(() => signR2PlaybackUrl('r2://taza-movies/m.mp4'), /R2 серверийн нууц холболт/);
  } finally {
    for (const [k, v] of Object.entries(previous)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});

test('the playback API checks payment entitlement before issuing an R2 URL', () => {
  const source = readFileSync(new URL('../app/api/playback/route.ts', import.meta.url), 'utf8');
  assert.ok(source.indexOf('siteEntryAllowed(') < source.indexOf('signR2PlaybackUrl('));
  assert.ok(source.indexOf('canWatch(') < source.indexOf('signR2PlaybackUrl('));
  assert.match(source, /isR2MovieReference\(source\)\?signR2PlaybackUrl\(source\)/);
});
