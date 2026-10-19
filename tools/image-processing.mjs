// Shared dev tooling: turns photos from local-images/ into the two sizes the site uses.
// Used by the frontend mock (frontend/mock/prepare-mock-data.mjs) and the local backend seed
// (backend/scripts/seed-local.mjs), so both produce identical images.
// Later the admin page does the same resizing in the browser (decision D-006).

import { createHash } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

export const FULL_SIZE = 2400;
export const THUMB_SIZE = 600;
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff']);

export const titleCase = (s) => s.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
export const shortId = (s) => createHash('sha1').update(s).digest('hex').slice(0, 8);

// Category ids must be URL-safe: lower case letters, digits and dashes.
export const toCategoryId = (name) =>
  name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

async function resize(src, size, quality) {
  const { data, info } = await sharp(src)
    .rotate() // apply EXIF orientation
    .resize(size, size, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

// Yields one category at a time: { id, title, images: [{ id, file, full, thumb }] }
// full/thumb = { data: Buffer, width, height }
export async function* processLocalImages(inputDir, log = console.log) {
  const dirs = (await readdir(inputDir, { withFileTypes: true }))
    .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
    .map((d) => d.name)
    .sort();

  for (const dir of dirs) {
    const categoryId = toCategoryId(dir);
    const files = (await readdir(path.join(inputDir, dir)))
      .filter((f) => IMAGE_EXT.has(path.extname(f).toLowerCase()))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    const images = [];
    for (const file of files) {
      const src = path.join(inputDir, dir, file);
      const id = shortId(`${categoryId}/${file}`);
      const full = await resize(src, FULL_SIZE, 82);
      const thumb = await resize(src, THUMB_SIZE, 78);
      log(`${dir}/${file} -> ${categoryId}/${id} (${full.width}x${full.height})`);
      images.push({ id, file, full, thumb });
    }
    yield { id: categoryId, title: titleCase(dir), images };
  }
}
