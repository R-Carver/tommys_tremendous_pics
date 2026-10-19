// Backend API tests. Run against the real Worker (npm run dev), skipped against the mock.
import { expect, test } from '@playwright/test';

test.skip(!!process.env.MOCK, 'Backend tests need the real Worker');
test.describe.configure({ mode: 'serial' });

test('GET /api/gallery follows the contract', async ({ request }) => {
  const res = await request.get('/api/gallery');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('application/json');
  expect(res.headers()['cache-control']).toBe('no-cache');

  const data = await res.json();
  expect(Array.isArray(data.categories)).toBeTruthy();
  for (const c of data.categories) {
    expect(typeof c.id).toBe('string');
    expect(typeof c.title).toBe('string');
    for (const img of c.images) {
      expect(typeof img.id).toBe('string');
      expect(img.thumb).toMatch(/^\/img\//);
      expect(img.full).toMatch(/^\/img\//);
    }
  }
});

test('image URLs from the API return cacheable JPEGs', async ({ request }) => {
  const data = await (await request.get('/api/gallery')).json();
  const img = data.categories.flatMap((c) => c.images)[0];
  test.skip(!img, 'No images seeded');

  for (const url of [img.thumb, img.full]) {
    const res = await request.get(url);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toBe('image/jpeg');
    expect(res.headers()['cache-control']).toContain('immutable');
    expect(res.headers()['etag']).toBeTruthy();
  }
});

test('repeat image request with ETag returns 304', async ({ request }) => {
  const data = await (await request.get('/api/gallery')).json();
  const img = data.categories.flatMap((c) => c.images)[0];
  test.skip(!img, 'No images seeded');

  const first = await request.get(img.thumb);
  const second = await request.get(img.thumb, { headers: { 'If-None-Match': first.headers()['etag'] } });
  expect(second.status()).toBe(304);
});

test('private bucket content is not reachable through /img/', async ({ request }) => {
  for (const url of ['/img/manifest.json', '/img/../manifest.json', '/img/%2e%2e/manifest.json', '/img/x/../../manifest.json']) {
    const res = await request.get(url);
    expect(res.status(), url).toBe(404);
  }
});

test('unknown API routes and write methods are rejected', async ({ request }) => {
  expect((await request.get('/api/nope')).status()).toBe(404);
  expect((await request.post('/api/gallery')).status()).toBe(405);
});
