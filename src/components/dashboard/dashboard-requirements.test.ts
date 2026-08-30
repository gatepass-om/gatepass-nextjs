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
const dashboardLayout = readFileSync(
  new URL('./dashboard-layout.ts', import.meta.url),
  'utf8',
);
const dashboardApi = readFileSync(
  new URL('../../lib/api.ts', import.meta.url),
  'utf8',
);
const dashboardSource = `${dashboardPage}\n${dashboardVisuals}\n${dashboardLayout}`;

test('dashboard keeps portfolio context available and the company filter scoped', () => {
  for (const label of ['Registered workers', 'Projects', 'Sites', 'Contractors & consultants']) {
    assert.match(dashboardSource, new RegExp(label));
  }
  assert.match(dashboardPage, /aria-label=["']External company["']/);
});

test('dashboard header is concise and filters follow the scope hierarchy responsively', () => {
  assert.doesNotMatch(dashboardPage, /A focused .* view of the work that needs attention/);
  assert.doesNotMatch(dashboardPage, /const generatedAt =/);

  const filtersStart = dashboardPage.indexOf('aria-label="Dashboard filters"');
  const filtersEnd = dashboardPage.indexOf("reportingWindow === 'custom'", filtersStart);
  const filtersSection = dashboardPage.slice(filtersStart, filtersEnd);
  const operatorIndex = filtersSection.indexOf('aria-label="Operator"');
  const siteIndex = filtersSection.indexOf('aria-label="Site"');
  const companyIndex = filtersSection.indexOf('aria-label="External company"');
  const windowIndex = filtersSection.indexOf('aria-label="Reporting window"');

  assert.ok(filtersStart >= 0 && filtersEnd > filtersStart);
  assert.ok(operatorIndex >= 0 && operatorIndex < siteIndex);
  assert.ok(siteIndex < companyIndex);
  assert.ok(companyIndex < windowIndex);
  assert.match(filtersSection, /sm:grid-cols-2/);
  assert.match(filtersSection, /lg:grid-cols-4/);
  assert.match(filtersSection, /<DashboardTools/);
});

test('changing the operator clears dependent site and company filters', () => {
  assert.match(
    dashboardPage,
    /onValueChange=\{\(operatorId\) => \{\s*setSelectedOperatorId\(operatorId\);\s*setSelectedSiteId\('all'\);\s*setSelectedExternalCompanyId\('all'\);\s*\}\}/,
  );
});

test('external-company principals use and report their enforced company scope', () => {
  assert.match(dashboardPage, /const effectiveExternalCompanyId = userContractorId \?\? selectedExternalCompanyId/);
  assert.match(dashboardPage, /externalCompanyId: effectiveExternalCompanyId/);
  assert.match(dashboardPage, /externalCompanyId=\{effectiveExternalCompanyId\}/);
  assert.match(dashboardPage, /\{!userContractorId \? \(/);
});

test('optional company reference-data failures do not discard accessible sites', () => {
  assert.match(dashboardPage, /listOperatorsRequest\(token\)\.catch/);
  assert.match(dashboardPage, /listExternalCompaniesRequest\(token\)\.catch/);
  assert.doesNotMatch(
    dashboardPage,
    /Promise\.all\(\[\s*userRole === 'Operator Admin'[\s\S]+?listExternalCompaniesRequest\(token\)/,
  );
});

test('dashboard composition is role and tenant driven without client-name branches', () => {
  assert.match(dashboardSource, /audience\.metricKeys/);
  assert.match(dashboardSource, /audience\.panelKeys/);
  assert.match(dashboardPage, /DASHBOARD_ROLES[^\n]+Security/);
  assert.doesNotMatch(dashboardSource, /Nama|PDO|Worley/);
});

test('dashboard integrates latest-request coordination and warns only when data is stale', () => {
  assert.match(dashboardPage, /createLatestRequestCoordinator/);
  assert.match(dashboardPage, /coordinator\.run/);
  assert.match(dashboardPage, /result\.status === 'stale'/);
  assert.match(dashboardPage, /summaryResult\?\.displayScopeKey === summaryDisplayScopeKey/);
  assert.match(dashboardPage, /const summaryRequestScopeKey = \[summaryDisplayScopeKey, requestStatusFilter\]/);
  assert.match(dashboardPage, /const loadingAccessRequests =/);
  assert.match(dashboardPage, /setInterval\(\(\) => setFreshnessNowMs\(Date\.now\(\)\), 30_000\)/);
  assert.match(dashboardPage, /getDashboardFreshness/);
  assert.doesNotMatch(dashboardPage, /Search dashboard/);
  assert.doesNotMatch(dashboardVisuals, />LIVE</);
  assert.match(dashboardPage, /summaryFreshness\.isStale[\s\S]+?Data may be stale/);
  assert.doesNotMatch(dashboardPage, /summaryFreshness\.isStale \? 'Stale' : 'Live'/);
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
  assert.match(dashboardPage, /summaryResult\.data\.accessRequests/);
  assert.match(dashboardPage, /accessRequestStatus: requestStatusFilter === 'all'/);
  assert.match(dashboardApi, /params\.set\('accessRequestStatus', input\.accessRequestStatus\)/);
  assert.doesNotMatch(dashboardPage, /summary\?\.accessRequests \?\? \[\]\)\.filter/);
});

test('dashboard presents one daily operations view without planning or insights tabs', () => {
  assert.doesNotMatch(dashboardPage, /TabsTrigger/);
  assert.doesNotMatch(dashboardPage, />\s*Planning\s*</);
  assert.doesNotMatch(dashboardPage, />\s*Insights\s*</);
  assert.doesNotMatch(dashboardPage, /ReportSchedulesPanel|ShiftRostersPanel|ManagementScorecards|RegistrationFunnelPanel|InclusiveAdoptionPanel|DataQualityPanel/);
  assert.match(dashboardPage, /OperationsActionQueue/);
  assert.match(dashboardPage, /Operational map/);
  assert.match(dashboardPage, /Access requests/);
});
