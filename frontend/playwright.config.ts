import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against a live stack: a backend with a migrated + seeded database and
 * the frontend. Point them at any deployment with E2E_BASE_URL (e.g. the Vercel site after a
 * release), or run locally - see README > Testing.
 *
 *   E2E_BASE_URL   frontend URL   (default http://localhost:5173)
 *   E2E_ADMIN / E2E_OFFICER / E2E_CITIZEN   demo account emails (password Password123!)
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'en-IN',
    geolocation: { latitude: 19.076, longitude: 72.8777 },
    permissions: ['geolocation'],
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } }, grepInvert: /@mobile/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, grep: /@mobile/ },
  ],
});
