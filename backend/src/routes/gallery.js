// GET /api/gallery – public gallery data. Contract: docs/api-contract.md

import { json } from '../http.js';
import { readManifest, toGalleryResponse } from '../manifest.js';

export async function handleGallery(request, env) {
  const manifest = await readManifest(env.BUCKET);
  // "no-cache": browsers may keep a copy but must ask again each time, so admin changes appear at once.
  return json(toGalleryResponse(manifest), { headers: { 'Cache-Control': 'no-cache' } });
}
