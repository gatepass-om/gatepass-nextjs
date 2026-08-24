import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's built-in TypeScript runner requires the source extension.
import { getDashboardChartTitle, getDashboardMetricCards, getDashboardTrendSeries, getRankedSiteBreakdown, getWorkforceStatusData } from './dashboard-layout.ts';

const summary = {
  totalOnSite: 42,
  movements: { entries: 31, exits: 20, denied: 3, manualOverrides: 0, total: 51 },
  pendingRequests: 7,
  deniedRequests: 3,
  expiry: { expired: 2, next7Days: 4, days8To30: 5, days31To60: 1, days61To90: 0 },
  workforce: { clearedWorkers: 84, readinessRate: 78 },
};

test('dashboard metric row prioritizes operational readiness and exceptions', () => {
  assert.deepEqual(
    getDashboardMetricCards(summary, true).map((metric) => metric.label),
    ['On site', 'Pending decisions', 'Readiness', 'Exceptions'],
  );
});

test('attendance metrics disappear for operators without check-in operations', () => {
  const cards = getDashboardMetricCards(summary, false);
  assert.deepEqual(cards.map((metric) => metric.label), ['Pending decisions', 'Readiness', 'Exceptions']);
  assert.equal(getDashboardChartTitle(false), 'Clearance pipeline');
});

test('attendance operators see movement activity as the primary chart', () => {
  assert.equal(getDashboardChartTitle(true), 'Movement activity');
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
