// Fills an R2 bucket with the photos from local-images/.
//
//   npm run seed                       -> LOCAL simulated bucket (.wrangler/), used by `npm run dev`
//   npm run seed:remote -- --yes       -> REAL Cloudflare bucket (needs `wrangler login`)
//   npm run seed:remote -- --dry-run   -> show what would be uploaded, upload nothing
//
// Steps: resize each photo (tools/image-processing.mjs), store <category>/<id>-full.jpg and
// <category>/<id>-thumb.jpg, then write manifest.json LAST, so the live site never points to
// images that are not uploaded yet.
//
// The remote mode is a stopgap until the admin page exists (decisions D-019). It overwrites the
// remote manifest.json. It does not delete old image files in the bucket; they are unused but harmless.

import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { processLocalImages } from '../../tools/image-processing.mjs';
import { MANIFEST_KEY, MANIFEST_VERSION, imageKey } from '../src/manifest.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const INPUT = path.join(ROOT, 'local-images');
const CONFIG = path.join(ROOT, 'wrangler.jsonc');

const args = new Set(process.argv.slice(2));
const REMOTE = args.has('--remote');
const DRY_RUN = args.has('--dry-run');
const CONFIRMED = args.has('--yes');

// ---------------------------------------------------------------------------------------------
// 1. Build everything in memory: a list of objects to store, manifest last.

async function buildObjects() {
  const manifest = { version: MANIFEST_VERSION, categories: [], images: {} };
  const objects = [];

  for await (const category of processLocalImages(INPUT)) {
    manifest.categories.push({ id: category.id, title: category.title });
    manifest.images[category.id] = [];
    for (const img of category.images) {
      objects.push({ key: imageKey(category.id, img.id, 'full'), data: img.full.data, contentType: 'image/jpeg' });
      objects.push({ key: imageKey(category.id, img.id, 'thumb'), data: img.thumb.data, contentType: 'image/jpeg' });
      manifest.images[category.id].push({
        id: img.id,
        title: null,
        description: null,
        width: img.full.width,
        height: img.full.height,
        thumbWidth: img.thumb.width,
        thumbHeight: img.thumb.height,
      });
    }
  }

  objects.push({
    key: MANIFEST_KEY,
    data: Buffer.from(JSON.stringify(manifest, null, 2)),
    contentType: 'application/json',
  });

  const imageCount = Object.values(manifest.images).reduce((n, list) => n + list.length, 0);
  return { objects, imageCount, categoryCount: manifest.categories.length };
}

// ---------------------------------------------------------------------------------------------
// 2a. Local target: the simulated bucket that `wrangler dev` uses.

async function seedLocal(objects) {
  const { getPlatformProxy } = await import('wrangler');
  const { env, dispose } = await getPlatformProxy({ configPath: CONFIG });
  try {
    const bucket = env.BUCKET;
    let cursor;
    let deleted = 0;
    do {
      const page = await bucket.list({ cursor });
      const keys = page.objects.map((o) => o.key);
      if (keys.length) await bucket.delete(keys);
      deleted += keys.length;
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
    console.log(`Cleared ${deleted} objects from the local bucket.`);

    for (const obj of objects) {
      await bucket.put(obj.key, obj.data, { httpMetadata: { contentType: obj.contentType } });
    }
  } finally {
    await dispose();
  }
}

// ---------------------------------------------------------------------------------------------
// 2b. Remote target: the real Cloudflare bucket, through `wrangler r2 object put --remote`.

async function bucketNameFromConfig() {
  const text = await readFile(CONFIG, 'utf8');
  const match = text.match(/"bucket_name"\s*:\s*"([^"]+)"/);
  if (!match) throw new Error('No "bucket_name" found in wrangler.jsonc');
  return match[1];
}

function runWrangler(wranglerArgs) {
  // The wrangler package does not export its bin file, so use the npm-installed command.
  const wranglerBin = path.join(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler');
  return new Promise((resolve, reject) => {
    const child = spawn(wranglerBin, wranglerArgs, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' });
    let output = '';
    child.stdout.on('data', (d) => (output += d));
    child.stderr.on('data', (d) => (output += d));
    child.on('close', (code) => (code === 0 ? resolve(output) : reject(new Error(`wrangler ${wranglerArgs.join(' ')}\n${output}`))));
  });
}

async function seedRemote(objects) {
  const bucket = await bucketNameFromConfig();
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'tommys-pics-seed-'));
  try {
    const images = objects.filter((o) => o.key !== MANIFEST_KEY);
    const manifest = objects.find((o) => o.key === MANIFEST_KEY);

    const upload = async (obj) => {
      const file = path.join(tmp, obj.key);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, obj.data);
      await runWrangler(['r2', 'object', 'put', `${bucket}/${obj.key}`, '--file', file, '--content-type', obj.contentType, '--remote']);
    };

    // Images first, a few at a time.
    const PARALLEL = 4;
    let done = 0;
    for (let i = 0; i < images.length; i += PARALLEL) {
      await Promise.all(images.slice(i, i + PARALLEL).map(upload));
      done += images.slice(i, i + PARALLEL).length;
      process.stdout.write(`\rUploaded ${done}/${images.length} image files`);
    }
    process.stdout.write('\n');

    // Manifest last: only now does the live site show the new images.
    await upload(manifest);
    console.log(`Uploaded ${MANIFEST_KEY}.`);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------------------------

async function main() {
  if (REMOTE && !DRY_RUN && !CONFIRMED) {
    const bucket = await bucketNameFromConfig();
    console.error(`This uploads local-images/ to the REAL Cloudflare R2 bucket "${bucket}" and replaces its manifest.json.`);
    console.error('Run again with --yes to confirm, or with --dry-run to only list what would be uploaded.');
    process.exit(1);
  }

  const { objects, imageCount, categoryCount } = await buildObjects();
  console.log(`\nPrepared ${imageCount} images in ${categoryCount} categories (${objects.length} objects).`);

  if (DRY_RUN) {
    const bucket = await bucketNameFromConfig();
    for (const o of objects) console.log(`  would upload ${bucket}/${o.key}  (${o.contentType}, ${o.data.length} bytes)`);
    return;
  }

  if (REMOTE) await seedRemote(objects);
  else await seedLocal(objects);

  console.log(`Done: ${REMOTE ? 'REMOTE Cloudflare' : 'local simulated'} bucket seeded.`);
}

main().catch((err) => { console.error(err.message || err); process.exit(1); });
