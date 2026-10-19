# tommys_pics

Portfolio website for a photographer. Static frontend (based on [Lens by HTML5 UP](https://html5up.net/lens)),
a small Cloudflare Worker backend, images in Cloudflare R2, and (soon) a minimal admin page.

- Project decisions, plan and progress: [`docs/decisions.html`](docs/decisions.html)
- Frontend/backend contract: [`docs/api-contract.md`](docs/api-contract.md)

## Repository layout

```
frontend/public/        Static site, deployed as-is (no build step)
  index.html
  assets/js/gallery.js  Loads GET /api/gallery, renders thumbnails, then starts Lens
  assets/js/main.js     Lens viewer (HTML5 UP, one small patch marked [tommys_pics])
  assets/css/custom.css Project style overrides (main.css stays original)
frontend/mock/          Mock API for frontend-only development
backend/src/            Cloudflare Worker: /api/gallery, /img/*, manifest handling
backend/scripts/        seed-local.mjs: fills the local simulated R2 bucket
tools/                  Dev tooling shared by both (image resizing), never deployed
tests/                  Playwright smoke tests
docs/                   Decisions and API contract
wrangler.jsonc          Cloudflare config joining frontend and backend
local-images/           Your test photos, one folder per category (git-ignored)
```

The frontend and backend only talk through HTTP (`GET /api/gallery`, image URLs). The frontend never imports backend code.

## Setup

Requires Node.js 20 or newer.

```bash
npm install
npx playwright install chromium   # only needed for the tests
```

Put test photos into `local-images/<category>/`, for example `local-images/landscape/lake.jpg`.

## Run locally with the real backend (simulated R2)

No Cloudflare account needed.

```bash
npm run seed   # resize local-images/ and load them into the local R2 bucket (.wrangler/)
npm run dev    # http://localhost:8787
```

## Run the frontend alone against the mock API

```bash
npm run mock:prepare   # local-images/ -> .mock-data/
npm run mock           # http://localhost:8788
```

Mock scenarios (only the mock server knows about them):

| URL | What it simulates |
|---|---|
| `http://localhost:8788/` | Normal gallery |
| `/?scenario=empty` | No images |
| `/?scenario=error` | API returns HTTP 500 |
| `/?scenario=slow` | API answers after 3 seconds |
| `/?scenario=broken` | One image file is missing |
| `/?scenario=single` | Only one image |

## Tests

Start a server first, then run the tests against it in a second terminal:

```bash
npm run dev    # then: npm run test:e2e        (frontend + backend API tests)
npm run mock   # then: npm run test:e2e:mock   (frontend tests incl. error scenarios)
```

## License

The site design is based on Lens by HTML5 UP, licensed under
[Creative Commons Attribution 3.0](frontend/public/LICENSE-HTML5UP.txt). The footer credit must stay.
