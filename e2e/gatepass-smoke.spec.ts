import { expect, test, type Page } from '@playwright/test';

async function login(page: Page, email = 'admin@gatepass.local', password = 'ChangeMe123!') {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/dashboard|\/access-requests/);
}

test.describe('GatePass frontend against ASP.NET backend', () => {
  test('admin can sign in and load dashboard summary', async ({ page }) => {
    await login(page);
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
    await expect(page.getByText(/on site|pending|approved/i).first()).toBeVisible();
  });

  test('smart access page loads provider and device operations', async ({ page }) => {
    await login(page);
    await page.goto('/smart-access');
    await expect(page.getByRole('heading', { name: /smart access/i })).toBeVisible();
    await expect(page.getByText(/ASSA ABLOY|Devices|Assignments|Sync Jobs/i).first()).toBeVisible();
  });

  test('location governance page loads geofences and assignments', async ({ page }) => {
    await login(page);
    await page.goto('/location-governance');
    await expect(page.getByRole('heading', { name: /location governance/i })).toBeVisible();
    await expect(page.getByText(/Marmul Central Facility Work Zone|Muscat Contractor Operating Region|Geofence Registry/i).first()).toBeVisible();
  });

  test('security user can reach scan workstation', async ({ page }) => {
    await login(page, 'security.marmul@gatepass.local', 'ChangeMe123!');
    await page.goto('/scan');
    await expect(page.getByRole('heading', { name: /scan/i })).toBeVisible();
    await expect(page.getByText(/scan|decision|visitor/i).first()).toBeVisible();
  });
});
