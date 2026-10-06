import { expect, test, type Page } from '@playwright/test';

async function login(page: Page, email = 'admin@gatepass.local', password = 'ChangeMe123!') {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

async function createSiteThroughUi(
  page: Page,
  name: string,
  capabilities: { approval: boolean; guarded: boolean; smart: boolean },
) {
  await page.goto('/sites');
  await page.getByRole('button', { name: /add site/i }).click();
  await page.getByLabel(/site name/i).fill(name);

  await page.getByRole('combobox', { name: /^operator$/i }).click();
  await page.getByRole('option', { name: /Petroleum Development Oman/i }).click();
  await page.getByRole('combobox', { name: /site managers/i }).click();
  await page.getByRole('option').first().click();
  await page.keyboard.press('Escape');

  if (capabilities.approval) await page.getByRole('switch', { name: /require access approval/i }).click();
  if (capabilities.guarded) await page.getByRole('switch', { name: /guarded security checkpoint/i }).click();
  if (capabilities.smart) await page.getByRole('switch', { name: /smart locks or mobile credentials/i }).click();

  await page.getByRole('button', { name: /create site/i }).click();
  await expect(page.getByRole('row').filter({ hasText: name })).toBeVisible();
}

async function deleteSiteThroughUi(page: Page, name: string) {
  const row = page.getByRole('row').filter({ hasText: name });
  await row.getByRole('button', { name: /more actions/i }).click();
  await page.getByRole('menuitem', { name: /^delete$/i }).click();
  await page.getByRole('button', { name: /^delete$/i }).click();
  await expect(row).toHaveCount(0);
}

test.describe('GatePass frontend against ASP.NET backend', () => {
  test.describe.configure({ mode: 'serial' });

  test('admin lands in the project-first operational workspace', async ({ page }) => {
    await login(page);
    await expect(page.getByRole('heading', { name: /^projects$/i })).toBeVisible();
    await expect(page.getByLabel(/project portfolio summary/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /new project/i })).toBeVisible();
    await expect(page.getByPlaceholder(/search by project/i)).toBeVisible();
    await expect(page.getByLabel(/filter projects by status/i)).toBeVisible();
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
    await expect(page.getByRole('heading', { name: /geofencing & work zones/i })).toBeVisible();
    await expect(page.getByText(/Marmul Central Facility Work Zone|Muscat Contractor Operating Region|Geofence Registry/i).first()).toBeVisible();
  });

  test('security user can view inspection analytics without a website scanner', async ({ page }) => {
    await login(page, 'security.marmul@gatepass.local', 'ChangeMe123!');
    await page.goto('/inspections');
    await expect(page.getByRole('heading', { name: /inspection analytics/i })).toBeVisible();
    await expect(page.getByText(/workers inspected/i).first()).toBeVisible();
    await expect(page.getByText(/common wrongful conduct/i)).toBeVisible();
    await expect(page.locator('#qr-scanner-container')).toHaveCount(0);
  });

  test('personnel management does not offer invalid static QR downloads', async ({ page }) => {
    await login(page);
    await page.goto('/users');
    await expect(page.getByRole('heading', { name: /^personnel$/i })).toBeVisible();
    await page.getByRole('button', { name: /more actions/i }).first().click();
    await expect(page.getByRole('menuitem', { name: /download qr/i })).toHaveCount(0);
  });

  test('worker profile removes the generic document uploader', async ({ page }) => {
    await login(page);
    await page.goto('/users');
    const workerRow = page.getByRole('row').filter({ hasText: /worker\.1@gatepass\.local/i });
    await workerRow.getByRole('button', { name: /more actions/i }).first().click();
    await page.getByRole('menuitem', { name: /^edit$/i }).first().click();
    await expect(page.getByRole('heading', { name: /personnel profile/i })).toBeVisible();

    await expect(page.getByRole('combobox', { name: /^document type$/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /upload file/i }).first()).toBeVisible();
  });

  test('certificate evidence can be linked to a certificate type before upload', async ({ page }) => {
    await login(page);
    await page.goto('/users');
    const workerRow = page.getByRole('row').filter({ hasText: /worker\.1@gatepass\.local/i });
    await workerRow.getByRole('button', { name: /more actions/i }).first().click();
    await page.getByRole('menuitem', { name: /^edit$/i }).first().click();

    await expect(page.getByRole('combobox', { name: /^certificate type$/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /upload file/i }).first()).toBeVisible();
  });

  test('profile photo uses its dedicated uploader and card issuance remains available', async ({ page }) => {
    await login(page);
    await page.goto('/users');
    const workerRow = page.getByRole('row').filter({ hasText: /worker\.1@gatepass\.local/i });
    await workerRow.getByRole('button', { name: /more actions/i }).first().click();
    await page.getByRole('menuitem', { name: /^edit$/i }).first().click();
    await expect(page.getByRole('heading', { name: /personnel profile/i })).toBeVisible();

    await page.locator('input[type="file"][accept="image/jpeg,image/png,image/webp"]').setInputFiles({
      name: 'worker-card-photo.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=',
        'base64',
      ),
    });
    await expect(page.getByRole('img', { name: /profile picture/i })).toBeVisible();
    await page.getByRole('button', { name: /^refresh$/i }).last().click();
    await expect(page.getByRole('combobox', { name: /verified worker photo/i })).toBeVisible();
    await expect(page.getByRole('combobox', { name: /verified worker photo/i })).toHaveText(/worker-card-photo\.png/i);
    const horizontalCrop = page.getByLabel(/card photo horizontal crop/i);
    await horizontalCrop.scrollIntoViewIfNeeded();
    await expect(horizontalCrop).toBeVisible();
    await expect(page.getByLabel(/card photo vertical crop/i)).toBeVisible();
    await expect(page.getByLabel(/card photo zoom/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /^issue card$/i })).toBeEnabled();
  });

  test('manager can open read-only worker compliance review', async ({ page }) => {
    await login(page, 'manager.marmul@gatepass.local', 'ChangeMe123!');
    await page.goto('/users');
    const workerRow = page.getByRole('row').filter({ hasText: /worker\.1@gatepass\.local/i });
    await workerRow.getByRole('button', { name: /more actions/i }).first().click();
    await page.getByRole('menuitem', { name: /^edit$/i }).click();

    await expect(page.getByRole('heading', { name: /personnel profile/i })).toBeVisible();
    await expect(page.getByText(/position requirements/i)).toBeVisible();
    await expect(page.getByText(/worker timeline/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /upload document/i })).toHaveCount(0);
  });

  test('site form exposes independent approval, security, and smart-access capabilities', async ({ page }) => {
    await login(page);
    await page.goto('/sites');
    await page.getByRole('button', { name: /add site/i }).click();

    await expect(page.getByRole('switch', { name: /require access approval/i })).toBeVisible();
    await expect(page.getByRole('switch', { name: /guarded security checkpoint/i })).toBeVisible();
    await expect(page.getByRole('switch', { name: /smart locks or mobile credentials/i })).toBeVisible();
  });

  test('the site register exposes usable pagination controls', async ({ page }) => {
    await login(page);

    await page.goto('/sites');
    await expect(page.getByText(/page 1 of \d+/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /previous sites page/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /next sites page/i })).toBeVisible();

  });

  test('browser journeys distinguish compliance-only sites from guarded authorization sites', async ({ page }) => {
    const runId = Date.now();
    const sortKey = String(Number.MAX_SAFE_INTEGER - runId).padStart(16, '0');
    const complianceSite = `00-${sortKey} Browser Compliance Open Area`;
    const guardedSite = `00-${sortKey} Browser Guarded Site`;

    await login(page);
    await createSiteThroughUi(page, complianceSite, { approval: false, guarded: false, smart: false });
    const complianceRow = page.getByRole('row').filter({ hasText: complianceSite });
    await expect(complianceRow.getByText(/compliance \/ open area/i)).toBeVisible();
    await complianceRow.getByRole('button', { name: /more actions/i }).click();
    await expect(page.getByRole('menuitem', { name: /manage smart access/i })).toHaveCount(0);
    await page.keyboard.press('Escape');

    await createSiteThroughUi(page, guardedSite, { approval: true, guarded: true, smart: false });
    const guardedRow = page.getByRole('row').filter({ hasText: guardedSite });
    await expect(guardedRow.getByText(/^approval$/i)).toBeVisible();
    await expect(guardedRow.getByText(/^guarded$/i)).toBeVisible();
    await expect(guardedRow.getByText(/smart access/i)).toHaveCount(0);

    await page.goto('/sites');
    await deleteSiteThroughUi(page, complianceSite);
    await deleteSiteThroughUi(page, guardedSite);
  });
});
