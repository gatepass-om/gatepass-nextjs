import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's built-in TypeScript runner requires the source extension.
import { getDashboardExportRows } from './dashboard-export.ts';

const summary = {
  generatedAtUtc: '2026-08-24T10:00:00.000Z',
  window: { fromUtc: '2026-08-23T10:00:00.000Z', toUtc: '2026-08-24T10:00:00.000Z' },
  audience: {
    role: 'Security',
    profileKey: 'security',
    metricKeys: ['people-on-site', 'entries', 'exits', 'denied-attempts'],
    panelKeys: ['movement-activity', 'site-pulse'],
  },
  totalOnSite: 12,
  pendingRequests: 9,
  approvedRequests: 8,
  deniedRequests: 7,
  movements: { total: 18, entries: 10, exits: 7, denied: 1 },
  workforce: { eligibleWorkers: 99, clearedWorkers: 50, pendingWorkers: 30, returnedWorkers: 19, readinessRate: 51 },
  expiry: { expired: 11, next7Days: 12, days8To30: 13 },
  portfolio: { registeredWorkers: 1_000, projects: 20, sites: 8, externalCompanies: 30, consultants: 4 },
  actionQueue: [],
};

test('security export contains only its composed operational metrics and panels', () => {
  const rows = getDashboardExportRows(summary, true);
  const labels = rows.map(([label]) => label);

  assert.ok(labels.includes('On site now'));
  assert.ok(labels.includes('Movements'));
  assert.ok(labels.includes('Entries'));
  assert.ok(labels.includes('Exits'));
  assert.ok(labels.includes('Denied movements'));
  assert.ok(!labels.some((label) => /workforce|credential|registration|worker profiles|projects|companies/i.test(label)));
});

test('tenant-hidden panels and metrics stay out of the export', () => {
  const rows = getDashboardExportRows({
    ...summary,
    audience: {
      ...summary.audience,
      role: 'OperatorAdmin',
      profileKey: 'operator-admin',
      metricKeys: ['pending-decisions'],
      panelKeys: ['action-queue'],
    },
  }, true);
  const labels = rows.map(([label]) => label);

  assert.ok(labels.includes('Pending requests'));
  assert.ok(!labels.includes('On site now'));
  assert.ok(!labels.includes('Movements'));
  assert.ok(!labels.includes('Eligible workforce'));
  assert.ok(!labels.includes('Registered workers'));
});

test('export records the active external-company scope', () => {
  const rows = getDashboardExportRows(summary, true, {
    operatorId: 'all',
    siteId: 'all',
    externalCompanyId: 'company-42',
    externalCompanyName: 'Muscat Safety Consultants',
    accessRequestStatus: 'Denied',
  });

  assert.deepEqual(
    rows.find(([label]) => label === 'External company filter'),
    ['External company filter', 'Muscat Safety Consultants (company-42)'],
  );
  assert.deepEqual(
    rows.find(([label]) => label === 'Access request filter'),
    ['Access request filter', 'Denied'],
  );
});
