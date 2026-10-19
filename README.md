# tommys_pics

Portfolio website for a photographer. Static frontend (based on [Lens by HTML5 UP](https://html5up.net/lens))
on Cloudflare Pages, images in Cloudflare R2, with a minimal admin page.

- Project decisions: [`docs/decisions.html`](docs/decisions.html)
- Frontend/backend contract: [`docs/api-contract.md`](docs/api-contract.md)

## Project layout

```
public/                 Static site (deployed as-is, no build step)
  index.html
  assets/js/gallery.js  Loads GET /api/gallery and renders thumbnails, then starts Lens
  assets/js/main.js     Lens viewer (HTML5 UP, one small patch marked [tommys_pics])
  assets/css/custom.css Project style overrides (main.css stays original)
dev/
  prepare-mock-data.mjs Builds .mock-data/ from local-images/
  mock-server.mjs       Local mock of the API + image hosting (no dependencies)
docs/                   Decisions and API contract
local-images/           Your test photos, one folder per category (git-ignored)
.mock-data/             Generated mock data (git-ignored)
```

## Run the frontend locally (mock backend)

Requires Node.js 18 or newer.

```bash
npm install            # installs sharp, used only to prepare mock images
npm run mock:prepare   # local-images/<category>/* -> .mock-data/
npm run mock           # http://localhost:8788
```

Test scenarios (the frontend does not know about them; the mock server reads them from the page URL):

| URL | What it simulates |
|---|---|
| `http://localhost:8788/` | Normal gallery |
| `/?scenario=empty` | No images |
| `/?scenario=error` | API returns HTTP 500 |
| `/?scenario=slow` | API answers after 3 seconds |
| `/?scenario=broken` | One image file is missing |
| `/?scenario=single` | Only one image |

## License

The site design is based on Lens by HTML5 UP, licensed under
[Creative Commons Attribution 3.0](public/LICENSE-HTML5UP.txt). The footer credit must stay.
