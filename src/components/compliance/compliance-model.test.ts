import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's built-in TypeScript runner requires the source extension.
import { buildEmploymentPayload, canManageWorkflowRoles, externalCompanyTypeLabel, normalizeDutyKeys, normalizeExternalCompanyType } from './compliance-model.ts';

test('workflow-role configuration remains a platform-admin control', () => {
  assert.equal(canManageWorkflowRoles('Admin'), true);
  assert.equal(canManageWorkflowRoles('Operator Admin'), false);
  assert.equal(canManageWorkflowRoles('Contractor Admin'), false);
});

test('external company types accept API numbers and names', () => {
  assert.equal(normalizeExternalCompanyType(2), 2);
  assert.equal(normalizeExternalCompanyType('Consultant'), 2);
  assert.equal(normalizeExternalCompanyType('4'), 4);
  assert.equal(normalizeExternalCompanyType(undefined), 1);
  assert.equal(externalCompanyTypeLabel(5), 'Auditor');
});

test('duty keys are normalized, deduplicated, and validated', () => {
  assert.deepEqual(
    normalizeDutyKeys(' Work-Pass.Review, project.manage-crew\nwork-pass.review '),
    ['work-pass.review', 'project.manage-crew'],
  );
  assert.throws(() => normalizeDutyKeys('work pass approve'), /letters, numbers/);
});

test('employment payload keeps existing details while changing job position', () => {
  assert.deepEqual(buildEmploymentPayload({
    jobPositionId: 'position-2',
    contractorId: 'company-1',
    operatorId: undefined,
    existing: {
      id: 'employment-1',
      contractorId: 'company-1',
      operatorId: null,
      employeeNumber: 'W-104',
      trade: 'Electrical',
      jobPositionId: 'position-1',
      jobPositionName: 'Electrician',
      department: 'Maintenance',
      supervisorUserId: null,
      employmentType: 'Contract',
      validFromUtc: '2026-01-01T00:00:00Z',
      validToUtc: null,
    },
  }), {
    contractorId: 'company-1',
    operatorId: undefined,
    employeeNumber: 'W-104',
    trade: 'Electrical',
    jobPositionId: 'position-2',
    department: 'Maintenance',
    supervisorUserId: undefined,
    employmentType: 'Contract',
    validFromUtc: '2026-01-01T00:00:00Z',
    validToUtc: undefined,
  });
});
