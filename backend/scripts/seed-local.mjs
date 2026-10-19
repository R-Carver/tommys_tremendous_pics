// Fills the LOCAL (simulated) R2 bucket with the photos from local-images/.
// It never touches the real Cloudflare bucket: getPlatformProxy() always uses local simulation.
//
// Usage: npm run seed   (then: npm run dev)
//
// What it does:
//   1. Deletes everything in the local bucket.
//   2. Resizes each photo (same sizes as the admin page will use, see tools/image-processing.mjs).
//   3. Stores <category>/<id>-full.jpg and <category>/<id>-thumb.jpg.
//   4. Writes manifest.json (format: backend/src/manifest.js).

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPlatformProxy } from 'wrangler';
import { processLocalImages } from '../../tools/image-processing.mjs';
import { MANIFEST_VERSION, imageKey, writeManifest } from '../src/manifest.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const INPUT = path.join(ROOT, 'local-images');

async function clearBucket(bucket) {
  let cursor;
  let deleted = 0;
  do {
    const page = await bucket.list({ cursor });
    const keys = page.objects.map((o) => o.key);
    if (keys.length) await bucket.delete(keys);
    deleted += keys.length;
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return deleted;
}

async function main() {
  const { env, dispose } = await getPlatformProxy({ configPath: path.join(ROOT, 'wrangler.jsonc') });
  try {
    const bucket = env.BUCKET;
    console.log(`Cleared ${await clearBucket(bucket)} objects from the local bucket.\n`);

    const manifest = { version: MANIFEST_VERSION, categories: [], images: {} };
    const jpeg = { httpMetadata: { contentType: 'image/jpeg' } };

    for await (const category of processLocalImages(INPUT)) {
      manifest.categories.push({ id: category.id, title: category.title });
      manifest.images[category.id] = [];
      for (const img of category.images) {
        await bucket.put(imageKey(category.id, img.id, 'full'), img.full.data, jpeg);
        await bucket.put(imageKey(category.id, img.id, 'thumb'), img.thumb.data, jpeg);
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

    await writeManifest(bucket, manifest);
    const total = Object.values(manifest.images).reduce((n, list) => n + list.length, 0);
    console.log(`\nSeeded ${total} images in ${manifest.categories.length} categories into the local R2 bucket.`);
  } finally {
    await dispose();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
