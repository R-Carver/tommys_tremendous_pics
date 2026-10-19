// GET /img/<category>/<id>-<full|thumb>.jpg – serves an image from R2.

import { errorResponse } from '../http.js';
import { IMAGE_KEY_PATTERN } from '../manifest.js';

export async function handleImage(request, env, rawKey) {
  let key;
  try {
    key = decodeURIComponent(rawKey);
  } catch {
    return errorResponse(404, 'Not found');
  }
  if (!IMAGE_KEY_PATTERN.test(key)) return errorResponse(404, 'Not found');

  // Passing the request headers lets R2 evaluate If-None-Match / If-Modified-Since for us.
  const object = await env.BUCKET.get(key, { onlyIf: request.headers });
  if (object === null) return errorResponse(404, 'Not found');

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'image/jpeg');
  // An image id never changes its content (D-010), so browsers and the CDN may keep it for a year.
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');

  // Precondition matched (the browser already has this version): R2 returns metadata without a body.
  if (!('body' in object) || object.body === null) return new Response(null, { status: 304, headers });

  return new Response(request.method === 'HEAD' ? null : object.body, { headers });
}
