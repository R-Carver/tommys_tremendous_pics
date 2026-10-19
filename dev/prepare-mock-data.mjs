// Builds local mock data for the frontend from the photos in local-images/.
//
// Input:  local-images/<category>/<any file>.jpg|png|webp
// Output: .mock-data/img/<category>/<id>-full.jpg   (max 2400 px on the long edge)
//         .mock-data/img/<category>/<id>-thumb.jpg  (max 600 px on the long edge)
//         .mock-data/gallery.json                    (a response in the GET /api/gallery format)
//
// This only simulates what the real backend and admin page will produce later.
// The frontend never sees any of these paths directly; it only reads gallery.json via the mock server.

import { createHash } from 'node:crypto';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.env.PROJECT_ROOT || path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const INPUT = path.join(ROOT, 'local-images');
const OUTPUT = path.join(ROOT, '.mock-data');
const FULL_SIZE = 2400;
const THUMB_SIZE = 600;
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff']);

const titleCase = (s) => s.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const shortId = (s) => createHash('sha1').update(s).digest('hex').slice(0, 8);

async function main() {
  await rm(OUTPUT, { recursive: true, force: true });

  const dirs = (await readdir(INPUT, { withFileTypes: true }))
    .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
    .map((d) => d.name)
    .sort();

  const categories = [];

  for (const category of dirs) {
    const files = (await readdir(path.join(INPUT, category)))
      .filter((f) => IMAGE_EXT.has(path.extname(f).toLowerCase()))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    const outDir = path.join(OUTPUT, 'img', category);
    await mkdir(outDir, { recursive: true });
    const images = [];

    for (const file of files) {
      const id = shortId(`${category}/${file}`);
      const src = path.join(INPUT, category, file);

      const full = await sharp(src).rotate()
        .resize(FULL_SIZE, FULL_SIZE, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 82, mozjpeg: true })
        .toFile(path.join(outDir, `${id}-full.jpg`));

      const thumb = await sharp(src).rotate()
        .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 78, mozjpeg: true })
        .toFile(path.join(outDir, `${id}-thumb.jpg`));

      images.push({
        id,
        title: null,
        description: null,
        thumb: `/img/${category}/${id}-thumb.jpg`,
        full: `/img/${category}/${id}-full.jpg`,
        width: full.width,
        height: full.height,
        thumbWidth: thumb.width,
        thumbHeight: thumb.height,
      });
      console.log(`${category}/${file} -> ${id} (${full.width}x${full.height})`);
    }

    categories.push({ id: category, title: titleCase(category), images });
  }

  await writeFile(path.join(OUTPUT, 'gallery.json'), JSON.stringify({ categories }, null, 2));
  const total = categories.reduce((n, c) => n + c.images.length, 0);
  console.log(`\nDone: ${total} images in ${categories.length} categories -> .mock-data/`);
}

main().catch((err) => { console.error(err); process.exit(1); });
