// Local mock server for frontend development. No dependencies.
//
//   GET /api/gallery  -> .mock-data/gallery.json (shape depends on the scenario)
//   GET /img/*        -> files from .mock-data/img/
//   GET /*            -> static files from public/
//
// Scenarios are chosen with ?scenario=... on the PAGE URL, e.g. http://localhost:8788/?scenario=empty
// The server reads it from the Referer header of the API request, so the frontend code knows nothing about it.
//
//   normal  (default)  full gallery
//   empty              gallery with no images
//   error              API answers HTTP 500
//   slow               API answers after 3 seconds
//   broken             one image URL points to a missing file
//   single             only one image

import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const MOCK_DIR = path.join(ROOT, '.mock-data');
const PORT = Number(process.env.PORT) || 8788;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.webp': 'image/webp', '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.eot': 'application/vnd.ms-fontobject',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function scenarioOf(req) {
  try { return new URL(req.headers.referer).searchParams.get('scenario') || 'normal'; }
  catch { return 'normal'; }
}

async function sendFile(res, baseDir, urlPath, cacheControl) {
  const file = path.normalize(path.join(baseDir, decodeURIComponent(urlPath)));
  if (!file.startsWith(baseDir + path.sep)) return send(res, 403, 'Forbidden');
  try {
    let target = file;
    if ((await stat(target)).isDirectory()) target = path.join(target, 'index.html');
    await stat(target);
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(target).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': cacheControl,
    });
    createReadStream(target).pipe(res);
  } catch {
    send(res, 404, 'Not found');
  }
}

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

async function gallery(req, res) {
  const scenario = scenarioOf(req);
  let data;
  try {
    data = JSON.parse(await readFile(path.join(MOCK_DIR, 'gallery.json'), 'utf8'));
  } catch {
    return send(res, 500, JSON.stringify({ error: 'Mock data missing. Run: npm run mock:prepare' }), 'application/json');
  }

  switch (scenario) {
    case 'empty': data.categories.forEach((c) => { c.images = []; }); break;
    case 'error': return send(res, 500, JSON.stringify({ error: 'Simulated server error' }), 'application/json');
    case 'slow': await sleep(3000); break;
    case 'broken': {
      const first = data.categories.find((c) => c.images.length);
      if (first) first.images[0].full = first.images[0].thumb = '/img/does-not-exist.jpg';
      break;
    }
    case 'single': {
      const first = data.categories.find((c) => c.images.length);
      data.categories = first ? [{ ...first, images: [first.images[0]] }] : [];
      break;
    }
  }
  send(res, 200, JSON.stringify(data), 'application/json');
}

http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  console.log(`${req.method} ${pathname}${pathname === '/api/gallery' ? `  [scenario: ${scenarioOf(req)}]` : ''}`);

  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
  if (pathname === '/api/gallery') return gallery(req, res);
  if (pathname.startsWith('/img/')) return sendFile(res, path.join(MOCK_DIR, 'img'), pathname.slice(5), 'public, max-age=31536000, immutable');
  return sendFile(res, PUBLIC_DIR, pathname, 'no-cache');
}).listen(PORT, () => {
  console.log(`Mock server: http://localhost:${PORT}`);
  console.log('Scenarios: ?scenario=normal | empty | error | slow | broken | single');
});
