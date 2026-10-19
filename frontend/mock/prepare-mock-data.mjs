// Builds local mock data for frontend development from the photos in local-images/.
//
// Output: .mock-data/img/<category>/<id>-full.jpg and <id>-thumb.jpg
//         .mock-data/gallery.json  (a response in the GET /api/gallery format, see docs/api-contract.md)
//
// The frontend never sees these paths directly. It only reads gallery.json through the mock server.

import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { processLocalImages } from '../../tools/image-processing.mjs';

const ROOT = process.env.PROJECT_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const INPUT = path.join(ROOT, 'local-images');
const OUTPUT = path.join(ROOT, '.mock-data');

async function main() {
  await rm(OUTPUT, { recursive: true, force: true });
  const categories = [];

  for await (const category of processLocalImages(INPUT)) {
    const outDir = path.join(OUTPUT, 'img', category.id);
    await mkdir(outDir, { recursive: true });
    const images = [];
    for (const img of category.images) {
      await writeFile(path.join(outDir, `${img.id}-full.jpg`), img.full.data);
      await writeFile(path.join(outDir, `${img.id}-thumb.jpg`), img.thumb.data);
      images.push({
        id: img.id,
        title: null,
        description: null,
        thumb: `/img/${category.id}/${img.id}-thumb.jpg`,
        full: `/img/${category.id}/${img.id}-full.jpg`,
        width: img.full.width,
        height: img.full.height,
        thumbWidth: img.thumb.width,
        thumbHeight: img.thumb.height,
      });
    }
    categories.push({ id: category.id, title: category.title, images });
  }

  await mkdir(OUTPUT, { recursive: true });
  await writeFile(path.join(OUTPUT, 'gallery.json'), JSON.stringify({ categories }, null, 2));
  const total = categories.reduce((n, c) => n + c.images.length, 0);
  console.log(`\nDone: ${total} images in ${categories.length} categories -> .mock-data/`);
}

main().catch((err) => { console.error(err); process.exit(1); });
