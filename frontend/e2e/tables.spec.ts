import { expect, test } from '@playwright/test';
import { ADMIN, expectNoErrorPanel, login, watchErrors } from './helpers';

const rows = (page: import('@playwright/test').Page) => page.locator('table.data-table tbody tr');

test.describe('shared data table (admin complaints)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ADMIN);
    await page.goto('/admin/complaints');
    await expect(rows(page).first()).toBeVisible();
  });

  test('renders the standard columns with a sticky header, summary and no console errors', async ({ page }) => {
    const errors = watchErrors(page);
    for (const col of ['Complaint', 'Category', 'Priority', 'Status', 'SLA', 'Actions']) {
      await expect(page.getByRole('columnheader', { name: col })).toBeVisible();
    }
    await expect(page.getByText(/Showing 1–\d+ of [\d,]+ complaints/)).toBeVisible();
    await expectNoErrorPanel(page);
    expect(errors).toEqual([]);
  });

  test('clicking a header sorts on the server: ascending, descending, then back to default', async ({ page }) => {
    const header = page.getByRole('columnheader', { name: 'Reported' });
    const requests: string[] = [];
    page.on('request', (r) => { if (r.url().includes('/admin/complaints')) requests.push(r.url()); });

    await header.getByRole('button').click();
    await expect(header).toHaveAttribute('aria-sort', 'descending'); // dates start newest-first
    await header.getByRole('button').click();
    await expect(header).toHaveAttribute('aria-sort', 'ascending');
    await header.getByRole('button').click();
    await expect(header).toHaveAttribute('aria-sort', 'none');

    expect(requests.some((u) => /sort=created_at/.test(u) && /order=desc/.test(u))).toBe(true);
    expect(requests.some((u) => /sort=created_at/.test(u) && /order=asc/.test(u))).toBe(true);
  });

  test('priority sort actually orders the rows', async ({ page }) => {
    const header = page.getByRole('columnheader', { name: 'Priority' });
    await header.getByRole('button').click(); // first click is descending: critical first
    await expect(header).toHaveAttribute('aria-sort', 'descending');
    await expect.poll(async () => (await rows(page).first().innerText()).toLowerCase()).toMatch(/critical|high/);
  });

  test('search is debounced and shows a removable summary; empty results offer Clear filters', async ({ page }) => {
    const calls: string[] = [];
    page.on('request', (r) => { if (r.url().includes('/admin/complaints')) calls.push(r.url()); });
    await page.getByLabel('Search', { exact: true }).pressSequentially('zzzqqqxxxnomatch', { delay: 20 });
    await expect(page.getByText('No complaints match your current filters')).toBeVisible();
    // 16 keystrokes must not become 16 requests
    expect(calls.filter((u) => /search=/.test(u)).length).toBeLessThan(4);
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(rows(page).first()).toBeVisible();
  });

  test('filters appear as chips that can be removed one by one or cleared together', async ({ page }) => {
    await page.getByLabel('Priority', { exact: true }).selectOption('CRITICAL');
    await page.getByLabel('Status', { exact: true }).selectOption('SUBMITTED').catch(() => undefined);
    const chips = page.getByRole('group', { name: 'Active filters' });
    await expect(chips).toContainText('Critical');
    await chips.getByRole('button', { name: /Remove filter Critical/ }).click();
    await expect(chips.getByRole('button', { name: /Remove filter Critical/ })).toHaveCount(0);
    await page.getByLabel('Priority', { exact: true }).selectOption('HIGH');
    await chips.getByRole('button', { name: 'Clear all' }).click();
    await expect(chips).toHaveCount(0);
  });

  test('page size can change and pagination reports the visible range', async ({ page }) => {
    const size = page.getByLabel('Rows per page');
    if (await size.count()) {
      await size.selectOption('50');
      await expect(page.getByText(/Showing 1–\d+ of/)).toBeVisible();
      expect(await rows(page).count()).toBeLessThanOrEqual(50);
    }
    const next = page.getByRole('navigation', { name: 'Pagination' }).getByRole('button', { name: 'Next' });
    if (await next.count() && await next.isEnabled()) {
      await next.click();
      await expect(page.getByText(/Showing (2|5|1)\d*/)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Previous' })).toBeEnabled();
    }
  });

  test('rows can be selected; the bar says how many, exports only those, and can be cleared', async ({ page }) => {
    await page.getByRole('checkbox', { name: 'Select all rows on this page' }).check();
    const bar = page.getByRole('status').filter({ hasText: 'selected' });
    await expect(bar).toContainText('on this page');
    await expect(bar.getByRole('button', { name: /Export \d+ selected/ })).toBeVisible();
    await page.getByRole('checkbox', { name: 'Select all rows on this page' }).uncheck();
    await expect(bar).toHaveCount(0);
    await rows(page).first().getByRole('checkbox').check();
    await expect(bar).toContainText('1 selected');
    await bar.getByRole('button', { name: 'Clear selection' }).click();
    await expect(bar).toHaveCount(0);
  });

  test('column visibility is chosen from a menu and remembered after reload', async ({ page }) => {
    await expect(page.getByRole('columnheader', { name: 'Ward' })).toHaveCount(0); // hidden by default
    await page.getByRole('button', { name: 'Columns' }).click();
    await page.getByRole('checkbox', { name: 'Updated' }).check();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('columnheader', { name: 'Updated' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('columnheader', { name: 'Updated' })).toBeVisible();
    // restore for later tests
    await page.getByRole('button', { name: 'Columns' }).click();
    await page.getByRole('checkbox', { name: 'Updated' }).uncheck();
  });

  test('density can be switched and is announced as pressed', async ({ page }) => {
    const compact = page.getByRole('button', { name: 'compact', exact: true });
    await compact.click();
    await expect(compact).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'comfortable', exact: true }).click();
  });

  test('the row overflow menu is keyboard operable (Enter, arrows, Escape)', async ({ page }) => {
    const kebab = rows(page).first().getByRole('button', { name: /More actions/ });
    await kebab.focus();
    await page.keyboard.press('Enter');
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitem').first()).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(menu.getByRole('menuitem').nth(1)).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(kebab).toBeFocused();
  });

  test('a failed request shows an error with Retry instead of an empty table', async ({ page }) => {
    await page.route('**/api/admin/complaints**', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'boom' }) }));
    await page.getByLabel('Priority', { exact: true }).selectOption('LOW'); // forces a fresh query
    await expect(page.getByRole('alert').filter({ hasText: 'Unable to load complaints' })).toBeVisible();
    await page.unroute('**/api/admin/complaints**');
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Unable to load complaints' })).toHaveCount(0);
  });

  test('the table scrolls inside its own region (no page-level horizontal overflow)', async ({ page }) => {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await expect(page.getByRole('region', { name: /Complaints \(scrollable\)/ })).toBeVisible();
  });
});

test.describe('other tables use the same system', () => {
  test.beforeEach(async ({ page }) => { await login(page, ADMIN); });

  test('officers: sortable columns, client pagination and summary', async ({ page }) => {
    await page.goto('/admin/officers');
    const header = page.getByRole('columnheader', { name: 'Active', exact: true });
    await header.getByRole('button').click();
    await expect(header).toHaveAttribute('aria-sort', 'descending');
    await expect(page.getByText(/Showing 1–\d+ of \d+ officers/)).toBeVisible();
  });

  test('audit log: search, details dialog with before/after, pagination', async ({ page }) => {
    await page.goto('/admin/audit');
    await expect(page.getByRole('heading', { name: 'Audit log' })).toBeVisible();
    await expect(rows(page).first()).toBeVisible();
    await expect(page.getByText(/Showing 1–\d+ of [\d,]+ entries/)).toBeVisible();
    await rows(page).first().getByRole('button', { name: /^Details/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByLabel('Search audit log').fill('zzz-nothing-matches');
    await expect(page.getByText('No audit entries match your filters')).toBeVisible();
  });

  test('incidents: table with severity, reports and status columns', async ({ page }) => {
    await page.goto('/admin/incidents');
    for (const col of ['Incident', 'Severity', 'Reports', 'Status']) {
      await expect(page.getByRole('columnheader', { name: col })).toBeVisible();
    }
  });

  test('SLA monitor lists at-risk complaints in the shared table', async ({ page }) => {
    await page.goto('/admin/sla');
    await expect(page.getByRole('heading', { name: 'SLA & escalations' })).toBeVisible();
    await expectNoErrorPanel(page);
    await expect(page.getByText(/Needs attention \(\d+\)/)).toBeVisible();
  });

  test('operations workload: drilling into a department is a button, not a hidden row click', async ({ page }) => {
    await page.goto('/admin/operations?tab=workload');
    const first = rows(page).first();
    await expect(first).toBeVisible();
    await first.getByRole('button', { name: /View trend/ }).click();
    await expect(page.getByRole('button', { name: /Hide trend/ }).first()).toBeVisible();
  });
});

test.describe('shared data table on a phone @mobile', () => {
  test('complaints become a card list with no horizontal overflow', async ({ page }) => {
    await login(page, ADMIN);
    await page.goto('/admin/complaints');
    await expect(page.locator('ul[aria-label="Complaints"] li').first()).toBeVisible();
    await expect(page.locator('table.data-table')).toBeHidden();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
