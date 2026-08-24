import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's built-in TypeScript runner requires the source extension.
import { parseDashboardSavedViews } from './dashboard-saved-views.ts';

test('saved dashboard views retain the external-company filter', () => {
  const [view] = parseDashboardSavedViews(JSON.stringify([{
    id: 'view-1',
    name: 'Consultant queue',
    operatorId: 'operator-1',
    siteId: 'all',
    externalCompanyId: 'consultant-1',
    accessRequestStatus: 'Denied',
    reportingWindow: '7d',
  }]));

  assert.equal(view.externalCompanyId, 'consultant-1');
  assert.equal(view.accessRequestStatus, 'Denied');
});

test('legacy saved dashboard views default to all external companies', () => {
  const [view] = parseDashboardSavedViews(JSON.stringify([{
    id: 'view-1',
    name: 'Legacy view',
    operatorId: 'operator-1',
    siteId: 'site-1',
    reportingWindow: '24h',
  }]));

  assert.equal(view.externalCompanyId, 'all');
  assert.equal(view.accessRequestStatus, 'all');
});
