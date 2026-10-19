// Frontend smoke tests. They only rely on the API contract (docs/api-contract.md),
// so they must pass against both the mock and the real backend.
import { expect, test } from '@playwright/test';

const MOCK = !!process.env.MOCK;

// Lens ignores input while a slide transition runs ("locked"). Wait until it is ready.
async function waitForViewerReady(page) {
  await page.waitForFunction(() => window.main && window.main.current !== null && !window.main.locked);
}

async function galleryImages(request) {
  const res = await request.get('/api/gallery');
  expect(res.ok()).toBeTruthy();
  const data = await res.json();
  return data.categories.flatMap((c) => c.images);
}

test('renders one thumbnail per image from the API, using the API URLs', async ({ page, request }) => {
  const images = await galleryImages(request);
  expect(images.length).toBeGreaterThan(0);

  await page.goto('/');
  const thumbs = page.locator('#thumbnails article .thumbnail');
  await expect(thumbs).toHaveCount(images.length);

  // The frontend must use the URLs exactly as the API sent them (no own path building).
  const hrefs = await thumbs.evaluateAll((els) => els.map((a) => a.getAttribute('href')));
  expect(new Set(hrefs)).toEqual(new Set(images.map((i) => i.full)));
});

test('opens the viewer and navigates with the keyboard', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Lens has no side-by-side viewer and no keyboard navigation on small screens');
  await page.goto('/');
  await expect(page.locator('#viewer .slide.active')).toBeVisible();
  await waitForViewerReady(page);

  await page.locator('#thumbnails article').nth(2).locator('.thumbnail').click();
  await expect(page.locator('#thumbnails article').nth(2)).toHaveClass(/active/);
  await waitForViewerReady(page);

  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#thumbnails article').nth(3)).toHaveClass(/active/);
});

test('shows no console errors on a normal load', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    // The Lens CSS loads a web font from Google; ignore it when the network blocks it.
    if (m.type() === 'error' && !/fonts\.googleapis|ERR_TUNNEL|ERR_NAME/.test(m.text())) errors.push(m.text());
  });
  await page.goto('/');
  await expect(page.locator('#thumbnails article').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test.describe('mock-only scenarios', () => {
  test.skip(!MOCK, 'Scenarios exist only in the mock server');

  test('empty gallery shows a message', async ({ page }) => {
    await page.goto('/?scenario=empty');
    await expect(page.locator('.gallery-message')).toContainText('No photos yet');
  });

  test('API error shows a message', async ({ page }) => {
    await page.goto('/?scenario=error');
    await expect(page.locator('.gallery-message')).toContainText('could not be loaded');
  });

  test('slow API shows loading, then the gallery', async ({ page }) => {
    await page.goto('/?scenario=slow');
    await expect(page.locator('.gallery-message')).toContainText('Loading');
    await expect(page.locator('#thumbnails article').first()).toBeVisible({ timeout: 10_000 });
  });

  test('a missing image does not lock the viewer', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Viewer navigation is desktop-only');
    await page.goto('/?scenario=broken');
    await waitForViewerReady(page);
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#thumbnails article').nth(1)).toHaveClass(/active/);
  });
});
