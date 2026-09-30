import { expect, type Page } from '@playwright/test';

export const PASSWORD = 'Password123!';
export const ADMIN = process.env.E2E_ADMIN || 'admin@civicconnect.demo';
export const OFFICER = process.env.E2E_OFFICER || 'officer.roads@civicconnect.demo';
export const CITIZEN = process.env.E2E_CITIZEN || 'aarav.sharma@example.demo';

/** Collects uncaught page errors and console errors so a test can assert the page stayed healthy. */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    // Network-level noise that is not an application bug (e.g. tile servers, favicon, deliberate 401/403 probes).
    if (/Failed to load resource|tile\.openstreetmap|favicon|net::ERR/i.test(text)) return;
    errors.push(`console: ${text}`);
  });
  return errors;
}

export async function login(page: Page, email: string, password = PASSWORD) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

export async function expectNoErrorPanel(page: Page) {
  await expect(page.getByText("We couldn't load this information.")).toHaveCount(0);
}
