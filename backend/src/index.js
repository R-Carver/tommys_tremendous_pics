// Cloudflare Worker entry point.
//
// Routing (see wrangler.jsonc "assets.run_worker_first"):
//   GET /api/gallery  -> public gallery data (docs/api-contract.md)
//   GET /img/*        -> image files from R2
//   everything else   -> static frontend files (frontend/public) via the ASSETS binding
//
// Bindings:
//   env.BUCKET  R2 bucket with images and manifest.json
//   env.ASSETS  static frontend files

import { handleGallery } from './routes/gallery.js';
import { handleImage } from './routes/images.js';
import { errorResponse } from './http.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    try {
      if (pathname === '/api/gallery') {
        if (!isRead(request)) return errorResponse(405, 'Method not allowed');
        return await handleGallery(request, env);
      }

      if (pathname.startsWith('/img/')) {
        if (!isRead(request)) return errorResponse(405, 'Method not allowed');
        return await handleImage(request, env, pathname.slice('/img/'.length));
      }

      if (pathname.startsWith('/api/')) return errorResponse(404, 'Not found');

      return env.ASSETS.fetch(request);
    } catch (err) {
      console.error(`${request.method} ${pathname} failed:`, err);
      return errorResponse(500, 'Internal error');
    }
  },
};

function isRead(request) {
  return request.method === 'GET' || request.method === 'HEAD';
}
