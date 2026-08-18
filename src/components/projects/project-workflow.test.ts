import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's built-in TypeScript runner requires the source extension.
import { buildCreateProjectPayload, calculateProjectPortfolio, filterSelectionOptions, getProjectStatusPresentation, resolveProjectOperatorId, shouldShowOperatorSelector, validateProjectStep } from './project-workflow.ts';

const validDraft = {
  name: '  Harbour Expansion  ',
  clientReference: '  PO-2044 ',
  description: '  Phase one access programme  ',
  operatorId: 'operator-1',
  consultantCompanyId: 'consultant-company-1',
  consultantReviewerUserIds: ['reviewer-1'],
  validFromUtc: '2026-08-01',
  validToUtc: '2026-10-31',
  contractorIds: ['contractor-1'],
  siteIds: ['site-1'],
  memberIds: ['user-1'],
  status: 'Active',
};

test('details step requires a name, operator, and valid date range', () => {
  const errors = validateProjectStep('details', {
    ...validDraft,
    name: ' ',
    operatorId: '',
    validToUtc: '2026-07-01',
  });

  assert.deepEqual(errors, {
    name: 'Project name is required.',
    operatorId: 'Select the responsible operator.',
    validToUtc: 'End date must be after the start date.',
  });
});

test('supervisors derive the responsible operator from project sites instead of choosing one', () => {
  assert.equal(shouldShowOperatorSelector('Supervisor', undefined, false), false);
  assert.equal(shouldShowOperatorSelector('Admin', undefined, false), true);
  assert.equal(resolveProjectOperatorId(undefined, '', 'operator-from-site'), 'operator-from-site');
  assert.deepEqual(
    validateProjectStep('details', { ...validDraft, operatorId: '' }, { requireOperator: false }),
    {},
  );
});

test('create payload trims text and converts project dates to UTC boundaries', () => {
  assert.deepEqual(buildCreateProjectPayload(validDraft), {
    name: 'Harbour Expansion',
    clientReference: 'PO-2044',
    description: 'Phase one access programme',
    operatorId: 'operator-1',
    consultantCompanyId: 'consultant-company-1',
    consultantReviewerUserIds: ['reviewer-1'],
    siteIds: ['site-1'],
    validFromUtc: '2026-08-01T00:00:00.000Z',
    validToUtc: '2026-10-31T23:59:59.000Z',
  });
});

test('portfolio statistics distinguish active, upcoming, completed and expiring projects', () => {
  const statistics = calculateProjectPortfolio([
    { status: 'Active', validFromUtc: '2026-07-01', validToUtc: '2026-08-05', workPassCount: 7 },
    { status: 'Draft', validFromUtc: '2026-09-01', validToUtc: '2026-12-01', workPassCount: 0 },
    { status: 'Completed', validFromUtc: '2026-01-01', validToUtc: '2026-06-01', workPassCount: 4 },
  ], new Date('2026-07-27T00:00:00Z'));

  assert.deepEqual(statistics, {
    total: 3,
    active: 1,
    upcoming: 1,
    completed: 1,
    endingSoon: 1,
    workPasses: 11,
  });
});

test('project workflow statuses are shown as clear business-facing labels', () => {
  const now = new Date('2026-08-02T12:00:00Z');
  const base = {
    validFromUtc: '2026-08-01T00:00:00Z',
    validToUtc: '2026-08-31T23:59:59Z',
  };

  assert.equal(getProjectStatusPresentation({ ...base, status: 'Closed' }, now).label, 'Closed');
  assert.deepEqual(getProjectStatusPresentation({ ...base, status: 'Expired' }, now), {
    label: 'Expired',
    tone: 'slate',
    detail: 'The project period ended and new worker access requests are disabled.',
  });
  assert.equal(getProjectStatusPresentation({ ...base, status: 'Active', consultantApprovedAtUtc: '2026-08-01T10:00:00Z' }, now).label, 'Active');
  assert.equal(getProjectStatusPresentation({ ...base, status: 'Active' }, now).label, 'Active');
  assert.equal(getProjectStatusPresentation({ ...base, status: 'Active', consultantApprovedAtUtc: '2026-08-01T10:00:00Z', validFromUtc: '2026-08-10T00:00:00Z' }, now).label, 'Upcoming');
  assert.equal(getProjectStatusPresentation({ ...base, status: 'Active', consultantApprovedAtUtc: '2026-08-01T10:00:00Z', validToUtc: '2026-08-01T00:00:00Z' }, now).label, 'Expired');
});

test('operator-scoped users are always locked to their own operator', () => {
  assert.equal(resolveProjectOperatorId('operator-a', 'operator-b'), 'operator-a');
  assert.equal(resolveProjectOperatorId('operator-a', ''), 'operator-a');
});

test('platform administrators can select an operator explicitly', () => {
  assert.equal(resolveProjectOperatorId(undefined, 'operator-b'), 'operator-b');
});

test('operator selection is only shown for a new project created outside an operator scope', () => {
  assert.equal(shouldShowOperatorSelector('Operator Admin', 'operator-a', false), false);
  assert.equal(shouldShowOperatorSelector('Admin', undefined, true), false);
  assert.equal(shouldShowOperatorSelector('Admin', undefined, false), true);
});

test('selection options support combined text search and category filters', () => {
  const options = [
    { id: '1', name: 'Marmul Supervisor', subtitle: 'Supervisor · marmul@example.com', category: 'Supervisor' },
    { id: '2', name: 'Khazzan Consultant', subtitle: 'Consultant · khazzan@example.com', category: 'Consultant' },
    { id: '3', name: 'Marmul Contractor', subtitle: 'Contractor Admin', category: 'Contractor Admin' },
  ];

  assert.deepEqual(
    filterSelectionOptions(options, 'marmul', 'Supervisor').map((option) => option.id),
    ['1'],
  );
  assert.deepEqual(
    filterSelectionOptions(options, 'khazzan', '').map((option) => option.id),
    ['2'],
  );
});
