import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const dashboardPage = readFileSync(
  new URL('../../app/(app)/dashboard/page.tsx', import.meta.url),
  'utf8',
);
const dashboardVisuals = readFileSync(
  new URL('./dashboard-visuals.tsx', import.meta.url),
  'utf8',
);
const dashboardSource = `${dashboardPage}\n${dashboardVisuals}`;

test('dashboard exposes the required portfolio totals and company filter', () => {
  for (const label of ['Registered workers', 'Projects', 'Sites', 'Contractors & consultants']) {
    assert.match(dashboardSource, new RegExp(label));
  }
  assert.match(dashboardPage, /aria-label=["']External company["']/);
});

test('dashboard map includes site overview points alongside geofences', () => {
  assert.match(dashboardPage, /points=\{mapPoints\}/);
  assert.match(dashboardPage, /registeredWorkers/);
  assert.match(dashboardPage, /projects/);
  assert.match(dashboardPage, /externalCompanies/);
  assert.match(dashboardPage, /const mapSiteSummaries = summary\?\.mapSites \?\? EMPTY_MAP_SITES/);
});

test('dashboard includes a filterable access request list for all decision states', () => {
  assert.match(dashboardSource, /All statuses/);
  assert.match(dashboardSource, /Pending/);
  assert.match(dashboardSource, /Approved/);
  assert.match(dashboardSource, /Rejected/);
  assert.match(dashboardSource, /summary\?\.accessRequests/);
});

test('dashboard presents one daily operations view without planning or insights tabs', () => {
  assert.doesNotMatch(dashboardPage, /TabsTrigger/);
  assert.doesNotMatch(dashboardPage, />\s*Planning\s*</);
  assert.doesNotMatch(dashboardPage, />\s*Insights\s*</);
  assert.doesNotMatch(dashboardPage, /ReportSchedulesPanel|ShiftRostersPanel|ManagementScorecards|RegistrationFunnelPanel|InclusiveAdoptionPanel|DataQualityPanel/);
  assert.match(dashboardPage, /<OperationsActionQueue/);
  assert.match(dashboardPage, /Operational map/);
  assert.match(dashboardPage, /Access requests/);
});
