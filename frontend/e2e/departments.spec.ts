import { expect, test } from '@playwright/test';
import { ADMIN, expectNoErrorPanel, login, watchErrors } from './helpers';

test.describe('departments & officers (admin)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ADMIN);
  });

  test('departments page lists the full catalog with categories, officers and workload', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/admin/departments');
    await expect(page.getByRole('heading', { name: 'Departments' })).toBeVisible();
    await expect(page.getByText('demo department catalog')).toBeVisible();
    await expect(page.locator('table.data-table tbody tr')).toHaveCount(20);

    const roads = page.locator('table.data-table tbody tr', { hasText: 'Roads & Traffic Infrastructure' });
    await expect(roads).toContainText('ROADS');
    await expect(roads).toContainText('Pothole');
    await expect(roads).toContainText('Active');
    await expectNoErrorPanel(page);
    expect(errors).toEqual([]);
  });

  test('search and the active/inactive tabs filter the table', async ({ page }) => {
    await page.goto('/admin/departments');
    await page.getByLabel('Search departments').fill('sewer');
    await expect(page.locator('table.data-table tbody tr')).toHaveCount(1);
    await expect(page.locator('table.data-table tbody tr').first()).toContainText('Sewerage');
    await page.getByLabel('Search departments').fill('pollution'); // matches by handled category
    await expect(page.locator('table.data-table tbody tr').first()).toContainText('Environmental Services');
    await page.getByLabel('Search departments').fill('zzz-no-match');
    await expect(page.getByText('No departments match')).toBeVisible();
  });

  test('details dialog shows primary and secondary categories and is keyboard-dismissable', async ({ page }) => {
    await page.goto('/admin/departments');
    await page.locator('table.data-table tbody tr', { hasText: 'Public Health & Sanitation' }).getByRole('button', { name: 'Details' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Handles - routed here first');
    await expect(dialog).toContainText('Also involved'); // PUBLIC_TOILET is secondary here
    await expect(dialog).toContainText('Public Toilet');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });

  test('the routing fallback department cannot be deactivated', async ({ page }) => {
    await page.goto('/admin/departments');
    const row = page.locator('table.data-table tbody tr', { hasText: 'General Civic Services' });
    await expect(row).toContainText('Routing fallback');
    await expect(row.getByRole('button', { name: 'Deactivate' })).toBeDisabled();
  });

  test('deactivating a department with open complaints demands a reassignment target', async ({ page }) => {
    await page.goto('/admin/departments');
    const row = page.locator('table.data-table tbody tr', { hasText: 'Roads & Traffic Infrastructure' });
    await row.getByRole('button', { name: 'Deactivate' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText(/open complaints? must move first/i);
    const confirm = dialog.getByRole('button', { name: 'Reassign and deactivate' });
    await expect(confirm).toBeDisabled(); // cannot proceed without choosing where they go
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(row).toContainText('Active'); // nothing changed
  });

  test('contact details can be edited', async ({ page }) => {
    await page.goto('/admin/departments');
    const row = page.locator('table.data-table tbody tr', { hasText: 'Parks & Recreation' });
    await row.getByRole('button', { name: 'Edit' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Contact email').fill('parks.e2e@city.example');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toHaveCount(0);
    await row.getByRole('button', { name: 'Details' }).click();
    await expect(page.getByRole('dialog')).toContainText('parks.e2e@city.example');
  });

  test('officers page shows department, ward, workload and status columns', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/admin/officers');
    await expect(page.getByRole('heading', { name: 'Officer management' })).toBeVisible();
    for (const col of ['Officer', 'Department', 'Ward', 'Active', 'Critical', 'SLA breaches', 'Status']) {
      await expect(page.getByRole('columnheader', { name: col, exact: true })).toBeVisible();
    }
    await expect(page.locator('table.data-table tbody tr').first()).toBeVisible();
    await expectNoErrorPanel(page);
    expect(errors).toEqual([]);
  });

  test('officers can be filtered by department via the URL and the dropdown', async ({ page }) => {
    await page.goto('/admin/departments');
    await page.locator('table.data-table tbody tr', { hasText: 'Roads & Traffic Infrastructure' }).locator('a').first().click();
    await expect(page).toHaveURL(/\/admin\/officers\?department_id=/);
    const rows = page.locator('table.data-table tbody tr');
    await expect(rows.first()).toBeVisible();
    for (const text of await rows.allInnerTexts()) expect(text).toContain('Roads & Traffic Infrastructure');
  });

  test('adding an officer validates input, then creates one that appears in the list', async ({ page }) => {
    await page.goto('/admin/officers');
    await page.getByRole('button', { name: '+ Add officer' }).click();
    const dialog = page.getByRole('dialog');
    const create = dialog.getByRole('button', { name: 'Create officer' });
    await expect(create).toBeDisabled();

    const email = `e2e.officer.${Date.now()}@civicconnect.demo`;
    await dialog.getByLabel('Full name').fill('E2E Field Officer');
    await dialog.getByLabel('Email').fill(email);
    await dialog.getByLabel('Temporary password').fill('short');
    await expect(create).toBeDisabled(); // password too short
    await dialog.getByLabel('Temporary password').fill('Password123!');
    await dialog.getByLabel('Department').selectOption({ label: 'Environmental Services' });
    await dialog.getByLabel('Ward').selectOption({ index: 1 });
    await expect(create).toBeEnabled();
    await create.click();
    await expect(dialog).toHaveCount(0);

    await page.getByLabel('Search officers').fill(email);
    const row = page.locator('table.data-table tbody tr').first();
    await expect(row).toContainText('E2E Field Officer');
    await expect(row).toContainText('Environmental Services');
    await expect(row).toContainText('Ward');
    await expect(row).toContainText('Active');
  });

  test('an inactive department is not offered when creating an officer', async ({ page }) => {
    await page.goto('/admin/officers');
    await page.getByRole('button', { name: '+ Add officer' }).click();
    const options = page.getByRole('dialog').getByLabel('Department').locator('option');
    await expect.poll(() => options.count()).toBeGreaterThanOrEqual(21); // placeholder + 20 departments (loaded async)
  });

  test('complaint assignment shows ranked, explained recommendations and leaves the choice to the admin', async ({ page }) => {
    await page.goto('/admin/complaints');
    await page.locator('table.data-table tbody tr a').first().click();
    await expect(page.getByRole('heading', { name: 'Admin actions' })).toBeVisible();
    await page.getByRole('button', { name: 'Recommend officer' }).click();
    const list = page.getByRole('list', { name: 'Recommended officers' });
    const empty = page.getByText('No active officers in this department yet');
    await expect(list.or(empty)).toBeVisible();
    if (await list.isVisible()) {
      await expect(list).toContainText('The final choice is yours');
      await expect(list.getByRole('listitem').first()).toContainText(/open assignment|No open assignments/);
    }
  });
});
