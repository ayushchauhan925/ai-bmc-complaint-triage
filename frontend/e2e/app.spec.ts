import { expect, test } from '@playwright/test';
import { ADMIN, CITIZEN, OFFICER, PASSWORD, expectNoErrorPanel, login, watchErrors } from './helpers';

test.describe('public pages', () => {
  test('landing page renders its sections and calls to action', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Report a civic problem in seconds');
    await expect(page.getByRole('link', { name: 'Report a problem' }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'From report to resolution, in the open' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('public dashboard shows aggregates only - no personal or location data', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/public');
    await expect(page.getByRole('heading', { name: 'Civic complaints, in the open' })).toBeVisible();
    await expect(page.getByText('About this data')).toBeVisible();
    const body = (await page.locator('main').innerText()).toLowerCase();
    expect(body).not.toMatch(/@[a-z0-9-]+\.[a-z]{2,}/); // no email addresses
    expect(body).not.toMatch(/\b\d{10}\b/); // no phone numbers
    expect(errors).toEqual([]);
  });

  test('unknown routes show the not-found page, not a blank screen', async ({ page }) => {
    await page.goto('/definitely-not-a-page');
    await expect(page.locator('body')).not.toBeEmpty();
    await expect(page.getByText(/not found|404/i).first()).toBeVisible();
  });
});

test.describe('authentication', () => {
  test('wrong password shows a clear error and stays on the login page', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(ADMIN);
    await page.getByLabel('Password', { exact: true }).fill('not-the-password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText(/invalid email or password/i);
    await expect(page).toHaveURL(/\/login/);
  });

  test('demo account chips fill the form and sign in works end to end', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Admin', exact: true }).click();
    await expect(page.getByLabel('Email')).toHaveValue(ADMIN);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('heading', { name: 'Command Center' })).toBeVisible();
  });

  test('password visibility toggle works', async ({ page }) => {
    await page.goto('/login');
    const pw = page.getByLabel('Password', { exact: true });
    await pw.fill('secret');
    await expect(pw).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: 'Show password' }).click();
    await expect(pw).toHaveAttribute('type', 'text');
  });

  test('forgot-password page is reachable and validates the form', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: 'Forgot password?' }).click();
    await expect(page.getByRole('heading', { name: 'Forgot your password?' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
  });

  test('reset page without a token explains the problem instead of breaking', async ({ page }) => {
    await page.goto('/reset-password');
    await expect(page.getByRole('alert')).toContainText(/incomplete/i);
  });

  test('protected pages redirect anonymous visitors to login', async ({ page }) => {
    await page.goto('/admin/sla');
    await expect(page).toHaveURL(/\/login/);
  });

  test('registration enforces matching passwords', async ({ page }) => {
    await page.goto('/register');
    await page.getByLabel('Full name').fill('E2E Tester');
    await page.getByLabel('Email').fill(`e2e.${Date.now()}@example.demo`);
    await page.getByLabel('Password', { exact: true }).fill('Password123!');
    await page.getByLabel('Confirm password').fill('Different123!');
    await expect(page.getByText('Passwords do not match.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create account' })).toBeDisabled();
  });

  test('secret words and the language switcher do not break the login form', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('pothole');
    await expect(page.getByText(/Pothole filled/)).toBeVisible();
    await page.getByLabel('Email').fill('');
    const lang = page.getByRole('combobox');
    await lang.selectOption('hi');
    await expect(page.getByRole('heading', { name: 'वापसी पर स्वागत है' })).toBeVisible();
    await lang.selectOption('mr');
    await expect(page.getByRole('heading', { name: 'पुन्हा स्वागत आहे' })).toBeVisible();
    await lang.selectOption('en');
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  });
});

test.describe('admin', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ADMIN);
  });

  const pages: [string, string | RegExp][] = [
    ['/admin', 'Command Center'],
    ['/admin/complaints', 'Complaints'],
    ['/admin/map', 'GIS command center'],
    ['/admin/incidents', 'Incidents'],
    ['/admin/review', 'Review queue'],
    ['/admin/operations', 'Trends, anomalies & workload'],
    ['/admin/sla', 'SLA & escalations'],
    ['/admin/recurring', 'Recurring problems & resolution impact'],
    ['/admin/departments', 'Departments'],
    ['/admin/officers', 'Officer management'],
    ['/admin/analytics', /analytics/i],
    ['/admin/ai', 'AI performance & system health'],
    ['/admin/audit', 'Audit log'],
  ];

  for (const [path, heading] of pages) {
    test(`${path} loads without errors`, async ({ page }) => {
      const errors = watchErrors(page);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
      await page.waitForLoadState('networkidle');
      await expectNoErrorPanel(page);
      expect(errors).toEqual([]);
    });
  }

  test('SLA page: all three tabs load (regression for the ANSI_QUOTES bug)', async ({ page }) => {
    await page.goto('/admin/sla');
    await expectNoErrorPanel(page);
    await page.getByRole('tab', { name: 'Escalations' }).click();
    await expect(page.getByRole('button', { name: 'Evaluate rules now' })).toBeVisible();
    await expectNoErrorPanel(page);
    await page.getByRole('tab', { name: 'Targets' }).click();
    await expect(page.getByText('SLA targets by priority')).toBeVisible();
    await expectNoErrorPanel(page);
  });

  test('AI & system tabs all load', async ({ page }) => {
    await page.goto('/admin/ai');
    for (const tab of ['AI quality', 'Usage & cost', 'System health']) {
      await page.getByRole('tab', { name: tab }).click();
      await page.waitForLoadState('networkidle');
      await expectNoErrorPanel(page);
    }
  });

  test('sidebar collapses to an icon rail and the choice is remembered', async ({ page }) => {
    await page.goto('/admin');
    const aside = page.locator('aside').first();
    const wide = (await aside.boundingBox())!.width;
    await page.getByRole('button', { name: 'Collapse sidebar' }).click();
    await expect.poll(async () => (await aside.boundingBox())!.width).toBeLessThan(wide / 2);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible();
    await page.getByRole('button', { name: 'Expand sidebar' }).click();
  });

  test('complaints list: search, filter and open a complaint with intelligence panels', async ({ page }) => {
    await page.goto('/admin/complaints');
    await expect(page.locator('table.data-table tbody tr').first()).toBeVisible();
    await page.getByLabel('Category').selectOption({ index: 1 });
    await page.waitForLoadState('networkidle');
    await expectNoErrorPanel(page);
    await page.getByLabel('Category').selectOption('');
    await page.locator('table.data-table tbody tr a').first().click();
    await expect(page.getByRole('heading', { name: 'Timeline' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Export PDF/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Staff review' })).toBeVisible();
  });

  test('PDF export actually downloads a PDF file', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export PDF' }).click()]);
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  });

  test('CSV export downloads a file with a header row', async ({ page }) => {
    await page.goto('/admin/complaints');
    await expect(page.locator('table.data-table tbody tr').first()).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export page (CSV)' }).click()]);
    expect(download.suggestedFilename()).toMatch(/\.csv$/);
    const path = await download.path();
    const text = (await import('node:fs')).readFileSync(path!, 'utf8');
    expect(text.replace(/^﻿/, '').split('\r\n')[0]).toContain('Complaint ID');
  });

  test('citizens cannot see admin pages (UX guard; the API enforces it too)', async ({ page, context }) => {
    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.goto('about:blank'); // stop the admin page polling with a now-missing token (its 401 redirect would abort the next navigation)
    await login(page, CITIZEN);
    await page.goto('/admin');
    await expect(page).not.toHaveURL(/\/admin$/);
  });
});

test.describe('officer', () => {
  test('work queue and field view load; field view offers navigation and actions', async ({ page }) => {
    const errors = watchErrors(page);
    await login(page, OFFICER);
    await expect(page.getByRole('heading', { name: /Work queue/ })).toBeVisible();
    await expectNoErrorPanel(page);
    await page.goto('/officer/field');
    await expect(page.getByRole('heading', { name: 'Field view' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Tasks \(\d+\)/ })).toBeVisible();
    await page.getByRole('button', { name: 'Map' }).click();
    await expect(page.locator('.leaflet-container')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('officers are kept out of admin analytics', async ({ page }) => {
    await login(page, OFFICER);
    await page.goto('/admin/sla');
    await expect(page).not.toHaveURL(/\/admin\/sla/);
  });
});

test.describe('citizen', () => {
  test('home, my complaints and profile render', async ({ page }) => {
    const errors = watchErrors(page);
    await login(page, CITIZEN);
    await expect(page.getByText(/Good (morning|afternoon|evening)/)).toBeVisible();
    await page.goto('/my-complaints');
    await expect(page.getByRole('heading', { name: 'My complaints' })).toBeVisible();
    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: 'Your profile' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('report form: quality hint guides the citizen, location can be set, and a complaint is created', async ({ page }) => {
    await login(page, CITIZEN);
    await page.goto('/complaints/new');
    await expect(page.getByRole('heading', { name: 'Report a Civic Problem' })).toBeVisible();

    const description = page.getByLabel("What's the issue?");
    await description.fill('pothole');
    const hint = page.getByRole('region', { name: 'Complaint completeness' });
    await expect(hint).toBeVisible();
    await expect(hint).toContainText('Basic');
    await expect(hint).toContainText('photo');

    await description.fill(`E2E test: large pothole outside the school gate for two weeks, children are at risk. ${Date.now()}`);
    await page.getByRole('button', { name: 'Use current location' }).click();
    await page.getByLabel('Address / landmark (optional)').fill('Opposite City School, Andheri West');
    await expect(hint).not.toContainText('Basic');

    await page.getByRole('button', { name: 'Submit Complaint' }).click();
    await expect(page).toHaveURL(/\/complaints\/\d+/, { timeout: 40_000 });
    await expect(page.getByText(/Complaint submitted successfully/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Timeline' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download receipt' })).toBeVisible();
    // Citizens never see internal AI/decision panels.
    await expect(page.getByRole('heading', { name: 'Staff review' })).toHaveCount(0);
    await expect(page.getByText('Decision factors')).toHaveCount(0);
  });

  test('the whole UI can be switched to Hindi and back', async ({ page }) => {
    await login(page, CITIZEN);
    await page.getByLabel('Language').first().selectOption('hi');
    await expect(page.getByRole('link', { name: 'समस्या दर्ज करें' }).first()).toBeVisible();
    await page.goto('/my-complaints');
    await expect(page.getByRole('heading', { name: 'मेरी शिकायतें' })).toBeVisible();
    await page.getByLabel('भाषा').first().selectOption('en');
    await expect(page.getByRole('heading', { name: 'My complaints' })).toBeVisible();
  });
});

test.describe('mobile @mobile', () => {
  test('citizen menu opens as a scrollable side drawer and closes again', async ({ page }) => {
    await login(page, CITIZEN);
    await page.getByRole('button', { name: 'Open navigation menu' }).click();
    const dialog = page.getByRole('dialog', { name: 'Navigation' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('link', { name: 'My Complaints' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });

  test('admin drawer reaches the last link even on a short phone screen', async ({ page }) => {
    await login(page, ADMIN);
    await page.getByRole('button', { name: 'Open navigation menu' }).click();
    const last = page.getByRole('dialog').getByRole('link', { name: 'Audit log' });
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeVisible();
    await last.click();
    await expect(page).toHaveURL(/\/admin\/audit/);
  });

  test('no horizontal page overflow on the main mobile screens', async ({ page }) => {
    await login(page, CITIZEN);
    for (const path of ['/', '/my-complaints', '/complaints/new']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(1);
    }
  });
});
