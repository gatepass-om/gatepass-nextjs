import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's built-in TypeScript runner requires the source extension.
import { getDashboardChartTitle, getDashboardMetricCards, getDashboardMetricGridClass, getDashboardTrendSeries, getPrimaryDashboardPanelKeys, getRankedSiteBreakdown, getWorkforceStatusData } from './dashboard-layout.ts';

const summary = {
  totalOnSite: 42,
  movements: { entries: 31, exits: 20, denied: 3, manualOverrides: 0, total: 51 },
  pendingRequests: 7,
  deniedRequests: 3,
  expiry: { expired: 2, next7Days: 4, days8To30: 5, days31To60: 1, days61To90: 0 },
  workforce: {
    eligibleWorkers: 108,
    pendingWorkers: 9,
    submittedWorkers: 5,
    underReviewWorkers: 4,
    clearedWorkers: 84,
    returnedWorkers: 6,
    readinessRate: 78,
  },
  portfolio: {
    registeredWorkers: 128,
    projects: 9,
    sites: 12,
    externalCompanies: 18,
    consultants: 3,
  },
  actionQueue: [
    { key: 'work-pass-consultant-approvals', label: 'Consultant decisions', count: 3, overdueCount: 1, applicable: true },
    { key: 'pending-approvals', label: 'Pending access decisions', count: 7, overdueCount: 2, applicable: true },
  ],
  audience: {
    metricKeys: [
      'people-on-site',
      'pending-decisions',
      'workforce-readiness',
      'credential-risk',
      'compliance-exceptions',
    ],
  },
};

test('dashboard renders the ordered metric composition returned by the API', () => {
  assert.deepEqual(
    getDashboardMetricCards(summary).map((metric) => metric.label),
    ['People on site', 'Pending decisions', 'Workforce readiness', 'Credential risk signals', 'Compliance signals'],
  );
});

test('security composition gets gate-operation metrics without workforce data', () => {
  const cards = getDashboardMetricCards({
    ...summary,
    audience: { metricKeys: ['people-on-site', 'entries', 'exits', 'denied-attempts'] },
  });
  assert.deepEqual(cards.map((metric) => metric.label), ['People on site', 'Entries', 'Exits', 'Denied attempts']);
});

test('assigned decisions use the viewers actionable queue and preserve a healthy zero', () => {
  const assigned = getDashboardMetricCards({
    ...summary,
    audience: { metricKeys: ['assigned-decisions'] },
  })[0];
  assert.equal(assigned.value, 3);
  assert.match(assigned.detail, /1 overdue/);

  const empty = getDashboardMetricCards({
    ...summary,
    actionQueue: [],
    audience: { metricKeys: ['assigned-decisions'] },
  })[0];
  assert.equal(empty.value, 0);
});

test('unknown metric keys fail closed instead of exposing fallback totals', () => {
  assert.deepEqual(getDashboardMetricCards({
    ...summary,
    audience: { metricKeys: ['future-secret-metric'] },
  }), []);
});

test('empty workforce displays unknown readiness instead of a misleading zero percent', () => {
  const cards = getDashboardMetricCards({
    ...summary,
    workforce: { ...summary.workforce, eligibleWorkers: 0, clearedWorkers: 0, readinessRate: 0 },
    audience: { metricKeys: ['workforce-readiness'] },
  });
  assert.equal(cards[0].value, '—');
  assert.equal(cards[0].detail, 'No workforce in this scope');
});

test('attendance operators see movement activity as the primary chart', () => {
  assert.equal(getDashboardChartTitle(true), 'Movement activity');
  assert.equal(getDashboardChartTitle(false), 'Clearance pipeline');
});

test('every configured primary panel remains renderable', () => {
  assert.deepEqual(
    getPrimaryDashboardPanelKeys(['movement-activity', 'clearance-pipeline'], true),
    ['movement-activity', 'clearance-pipeline'],
  );
  assert.deepEqual(
    getPrimaryDashboardPanelKeys(['movement-activity', 'clearance-pipeline'], false),
    ['clearance-pipeline'],
  );
});

test('metric grid remains balanced for every accepted composition size', () => {
  assert.match(getDashboardMetricGridClass(4), /lg:grid-cols-4/);
  assert.match(getDashboardMetricGridClass(5), /xl:grid-cols-5/);
  assert.match(getDashboardMetricGridClass(6), /xl:grid-cols-3/);
});

test('workforce status data keeps every clearance cohort visible', () => {
  assert.deepEqual(getWorkforceStatusData({
    eligibleWorkers: 12,
    clearedWorkers: 2,
    submittedWorkers: 3,
    underReviewWorkers: 4,
    pendingWorkers: 2,
    returnedWorkers: 1,
  }), [
    { name: 'Cleared', value: 2 },
    { name: 'Under review', value: 4 },
    { name: 'Submitted', value: 3 },
    { name: 'Pending', value: 2 },
    { name: 'Returned', value: 1 },
  ]);
});

test('trend series aggregates dense windows into readable buckets', () => {
  const points = Array.from({ length: 30 }, (_, index) => ({
    date: `2026-08-${String(index + 1).padStart(2, '0')}`,
    movements: 1,
    entries: 2,
    exits: 3,
    denied: 0,
  }));
  const result = getDashboardTrendSeries(points, 10);
  assert.equal(result.length, 10);
  assert.equal(result[0].movements, 3);
  assert.equal(result[0].entries, 6);
  assert.equal(result.at(-1)?.date, '2026-08-28–2026-08-30');
});

test('site breakdown preserves long-tail volume as other sites', () => {
  const sites = Array.from({ length: 8 }, (_, index) => ({ name: `Site ${index + 1}`, count: index + 1 }));
  assert.deepEqual(getRankedSiteBreakdown(sites, 5), [
    { name: 'Site 8', count: 8 },
    { name: 'Site 7', count: 7 },
    { name: 'Site 6', count: 6 },
    { name: 'Site 5', count: 5 },
    { name: 'Site 4', count: 4 },
    { name: 'Other sites', count: 6 },
  ]);
});
