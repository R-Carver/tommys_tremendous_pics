// Smoke tests. Start a server first, then run the tests against it:
//   npm run dev  + npm run test:e2e        (real backend, local R2, http://localhost:8787)
//   npm run mock + npm run test:e2e:mock   (mock API, http://localhost:8788, includes error scenarios)
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  timeout: 30_000,
  reporter: 'list',
  use: { baseURL: process.env.BASE_URL || 'http://localhost:8787' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
