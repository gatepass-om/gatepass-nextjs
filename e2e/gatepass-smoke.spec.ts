import { expect, test, type Page } from '@playwright/test';

async function login(page: Page, email = 'admin@gatepass.local', password = 'ChangeMe123!') {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/dashboard|\/access-requests/);
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

  test('admin dashboard prioritizes concise operational metrics and visual analysis', async ({ page }) => {
    await login(page);
    await expect(page.getByRole('heading', { name: /good morning, gatepass/i })).toBeVisible();
    await expect(page.getByRole('combobox', { name: /reporting window/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^overview$/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^planning$/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^insights$/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /movement activity|clearance pipeline/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /decision health|access decisions/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /workforce readiness/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /site pulse|workforce readiness/i })).toBeVisible();
    await expect(page.getByText(/pending decisions|readiness/i).first()).toBeVisible();
    await expect(page.getByText(/pending/i).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /operations command center/i })).toHaveCount(0);

    await page.getByRole('tab', { name: /^planning$/i }).click();
    await expect(page.getByRole('heading', { name: /scheduled reports/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /add report schedule/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^shift rosters$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /add shift roster/i })).toBeVisible();

    await page.getByRole('tab', { name: /^insights$/i }).click();
    await expect(page.getByRole('heading', { name: /contractor readiness/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /inclusive adoption/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /data quality/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^registration progress$/i })).toBeVisible();
    await expect(page.getByText('Submitted rate', { exact: true })).toBeVisible();

    await page.getByRole('tab', { name: /^overview$/i }).click();
    await page.getByRole('combobox', { name: /reporting window/i }).click();
    await page.getByRole('option', { name: /custom range/i }).click();
    await expect(page.getByLabel(/from date and time/i)).toBeVisible();
    await expect(page.getByLabel(/to date and time/i)).toBeVisible();
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

  test('security user can reach scan workstation', async ({ page }) => {
    await login(page, 'security.marmul@gatepass.local', 'ChangeMe123!');
    await page.goto('/scan');
    await expect(page.getByRole('heading', { name: /scan/i })).toBeVisible();
    await expect(page.getByText(/scan|decision|visitor/i).first()).toBeVisible();
  });

  test('security user can verify permanent worker cards without implying authorization', async ({ page }) => {
    await login(page, 'security.marmul@gatepass.local', 'ChangeMe123!');
    await page.goto('/card-verification');
    await expect(page.getByRole('heading', { name: /worker card verification/i })).toBeVisible();
    await expect(page.getByText(/identity verification only/i)).toBeVisible();
    await expect(page.getByText(/does not authorize entry/i)).toBeVisible();
    await expect(page.getByRole('combobox', { name: /offline manifest site/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /refresh offline identity list/i })).toBeVisible();
  });

  test('personnel management does not offer invalid static QR downloads', async ({ page }) => {
    await login(page);
    await page.goto('/users');
    await expect(page.getByRole('heading', { name: /personnel management/i })).toBeVisible();
    await page.getByRole('button', { name: /more actions/i }).first().click();
    await expect(page.getByRole('menuitem', { name: /download qr/i })).toHaveCount(0);
  });

  test('authorized reviewer can see pending worker evidence and verify it', async ({ page }) => {
    await login(page);
    await page.goto('/users');
    const workerRow = page.getByRole('row').filter({ hasText: /worker\.1@gatepass\.local/i });
    await workerRow.getByRole('button', { name: /more actions/i }).first().click();
    await page.getByRole('menuitem', { name: /^edit$/i }).first().click();
    await expect(page.getByRole('heading', { name: /edit user profile/i })).toBeVisible();

    await page.getByRole('combobox', { name: /document type/i }).click();
    await page.getByRole('option', { name: /id document/i }).click();
    await page.locator('input[type="file"]').setInputFiles({
      name: 'identity-review-test.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('identity evidence'),
    });

    const documentRow = page.getByRole('listitem').filter({ hasText: /identity-review-test\.pdf/i }).last();
    await expect(documentRow.getByText(/pending/i)).toBeVisible();
    await expect(documentRow.getByRole('button', { name: /verify/i })).toBeVisible();
  });

  test('certificate evidence can be linked to a certificate type before upload', async ({ page }) => {
    await login(page);
    await page.goto('/users');
    const workerRow = page.getByRole('row').filter({ hasText: /worker\.1@gatepass\.local/i });
    await workerRow.getByRole('button', { name: /more actions/i }).first().click();
    await page.getByRole('menuitem', { name: /^edit$/i }).first().click();

    await expect(page.getByRole('combobox', { name: /certificate type for evidence/i })).toBeVisible();
  });

  test('verified worker photo is available from the personnel card-issuance action', async ({ page }) => {
    await login(page);
    await page.goto('/users');
    const workerRow = page.getByRole('row').filter({ hasText: /worker\.1@gatepass\.local/i });
    await workerRow.getByRole('button', { name: /more actions/i }).first().click();
    await page.getByRole('menuitem', { name: /^edit$/i }).first().click();
    await expect(page.getByRole('heading', { name: /edit user profile/i })).toBeVisible();

    await page.getByRole('combobox', { name: /document type/i }).click();
    await page.getByRole('option', { name: /worker card photo/i }).click();
    await page.locator('input[type="file"]').setInputFiles({
      name: 'worker-card-photo.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=',
        'base64',
      ),
    });
    const photoRow = page.getByRole('listitem').filter({ hasText: /worker-card-photo\.png/i }).last();
    await photoRow.getByRole('button', { name: /^verify$/i }).click();
    await expect(photoRow.getByText(/^verified$/i)).toBeVisible();
    await page.getByRole('button', { name: /^close$/i }).click();

    await workerRow.getByRole('button', { name: /more actions/i }).first().click();
    await page.getByRole('menuitem', { name: /issue worker card/i }).click();
    await expect(page.getByRole('heading', { name: /issue worker card/i })).toBeVisible();
    await expect(page.getByRole('combobox', { name: /verified worker photo/i })).toHaveText(/worker-card-photo\.png/i);
    const horizontalCrop = page.getByLabel(/card photo horizontal crop/i);
    await horizontalCrop.scrollIntoViewIfNeeded();
    await expect(horizontalCrop).toBeVisible();
    await expect(page.getByLabel(/card photo vertical crop/i)).toBeVisible();
    await expect(page.getByLabel(/card photo zoom/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /^issue card$/i })).toBeEnabled();
  });

  test('administrators can open the worker card production queue', async ({ page }) => {
    await login(page);
    await page.goto('/card-production');

    await expect(page.getByRole('heading', { name: /worker card production/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /batch print selected/i })).toBeVisible();
    await expect(page.getByText(/identity verification.*does not authorize entry/i)).toBeVisible();
  });

  test('manager can open read-only worker compliance review', async ({ page }) => {
    await login(page, 'manager.marmul@gatepass.local', 'ChangeMe123!');
    await page.goto('/users');
    const workerRow = page.getByRole('row').filter({ hasText: /worker\.1@gatepass\.local/i });
    await workerRow.getByRole('button', { name: /more actions/i }).click();
    await page.getByRole('menuitem', { name: /review compliance/i }).click();

    await expect(page.getByRole('heading', { name: /worker compliance review/i })).toBeVisible();
    await expect(page.getByText(/worker clearance/i)).toBeVisible();
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

  test('large operational lists expose usable pagination controls', async ({ page }) => {
    await login(page);

    await page.goto('/sites');
    await expect(page.getByText(/page 1 of \d+/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /previous sites page/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /next sites page/i })).toBeVisible();

    await page.goto('/access-requests');
    await page.getByRole('tab', { name: /requests log/i }).click();
    await expect(page.getByText(/page 1 of \d+/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /previous access requests page/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /next access requests page/i })).toBeVisible();
  });

  test('browser journeys distinguish compliance-only sites from guarded authorization sites', async ({ page }) => {
    const runId = Date.now();
    const complianceSite = `Browser Compliance Open Area ${runId}`;
    const guardedSite = `Browser Guarded Site ${runId}`;

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
