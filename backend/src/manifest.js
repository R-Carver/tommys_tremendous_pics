// The manifest is the single source of truth for categories, images and their order (decision D-005).
// It is stored in R2 as "manifest.json". Image files are stored next to it:
//
//   manifest.json
//   <category>/<id>-full.jpg
//   <category>/<id>-thumb.jpg
//
// Stored format (backend-internal, NOT the public API):
// {
//   "version": 1,
//   "categories": [ { "id": "landscape", "title": "Landscape" } ],
//   "images": {
//     "landscape": [
//       { "id": "a7f3c201", "title": null, "description": null,
//         "width": 2400, "height": 1600, "thumbWidth": 600, "thumbHeight": 400 }
//     ]
//   }
// }
// Array order = display order.

export const MANIFEST_KEY = 'manifest.json';
export const MANIFEST_VERSION = 1;

// Only keys of this shape are ever served through /img/. This keeps manifest.json and anything
// else in the bucket private, and rules out path tricks like "../".
export const IMAGE_KEY_PATTERN = /^[a-z0-9][a-z0-9-]*\/[a-z0-9]+-(full|thumb)\.jpg$/;

export function emptyManifest() {
  return { version: MANIFEST_VERSION, categories: [], images: {} };
}

export function imageKey(categoryId, imageId, variant) {
  return `${categoryId}/${imageId}-${variant}.jpg`;
}

export async function readManifest(bucket) {
  const object = await bucket.get(MANIFEST_KEY);
  if (object === null) return emptyManifest();
  return object.json();
}

export async function writeManifest(bucket, manifest) {
  await bucket.put(MANIFEST_KEY, JSON.stringify(manifest, null, 2), {
    httpMetadata: { contentType: 'application/json' },
  });
}

// Converts the stored manifest into the public GET /api/gallery response (docs/api-contract.md).
export function toGalleryResponse(manifest) {
  const categories = Array.isArray(manifest.categories) ? manifest.categories : [];
  const images = manifest.images || {};

  return {
    categories: categories.map((category) => ({
      id: category.id,
      title: category.title,
      images: (images[category.id] || []).map((img) => {
        const item = {
          id: img.id,
          title: img.title ?? null,
          description: img.description ?? null,
          thumb: '/img/' + imageKey(category.id, img.id, 'thumb'),
          full: '/img/' + imageKey(category.id, img.id, 'full'),
        };
        for (const field of ['width', 'height', 'thumbWidth', 'thumbHeight', 'position']) {
          if (img[field] != null) item[field] = img[field];
        }
        return item;
      }),
    })),
  };
}
