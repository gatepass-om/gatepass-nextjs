import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('transfer requests are actionable only by the employing contractor administrator', () => {
  const project = { id: 'p', operatorId: 'operator', supervisorUserId: 'consultant', consultantCompanyId: 'consultant-company' } as CommandCenterProject;
  const pass = { id: 'transfer', projectId: 'p', status: 'PendingContractorApproval', submittedByUserId: 'requester',
    workers: [{ userId: 'worker', contractorId: 'employer', transferStatus: 'Pending' }] } as CommandCenterWorkPass;
  assert.deepEqual(getWorkPassActions(pass, project, { id: 'employer-admin', role: 'Contractor Admin', contractorId: 'employer' }), ['review-transfer']);
  assert.deepEqual(getWorkPassActions(pass, project, { id: 'other-admin', role: 'Contractor Admin', contractorId: 'other' }), []);
  assert.deepEqual(getWorkPassActions(pass, project, { id: 'operator-admin', role: 'Operator Admin', operatorId: 'operator' }), []);
});
// @ts-expect-error Node's built-in TypeScript runner requires the source extension.
import { getProjectWorkflowStages, getWorkPassActions, getWorkPassQueueItems, getWorkPassStatusPresentation, isWorkerComplianceSatisfied, workerComplianceBadge, type CommandCenterProject, type CommandCenterWorkPass } from './project-command-center.ts';

const workPassDetailSource = readFileSync(new URL('../../app/(app)/projects/[id]/access-requests/[workPassId]/page.tsx', import.meta.url), 'utf8');
const reportsPageSource = readFileSync(new URL('../../app/(app)/reports/page.tsx', import.meta.url), 'utf8');

const project: CommandCenterProject = {
  id: 'project-1',
  name: 'North Field Upgrade',
  status: 'Active',
  operatorId: 'operator-1',
  supervisorUserId: 'supervisor-1',
  consultantCompanyId: 'consultant-company-1',
  consultantReviewerUserIds: ['consultant-reviewer-1'],
  consultantApprovedAtUtc: '2026-08-01T08:00:00Z',
};

test('work-pass actions follow contractor, consultant verification, then operator decision', () => {
  const draft = { id: 'wp-1', status: 'Draft', submittedByUserId: 'contractor-1', submittingContractorId: 'galfar' } as CommandCenterWorkPass;
  const submitted = { ...draft, status: 'Submitted' };
  const second = { ...draft, status: 'PendingSecondApproval' };

  assert.deepEqual(getWorkPassActions(draft, project, { id: 'contractor-1', role: 'Supervisor' }), ['submit']);
  assert.deepEqual(getWorkPassActions(submitted, project, { id: 'consultant-reviewer-1', role: 'Contractor Admin' }), []);
  assert.deepEqual(getWorkPassActions(submitted, project, { id: 'supervisor-1', role: 'Supervisor' }), []);
  assert.deepEqual(getWorkPassActions(submitted, project, { id: 'supervisor-1', role: 'Supervisor', contractorId: 'consultant-company-1' }), ['approve', 'reject']);
  assert.deepEqual(getWorkPassActions(submitted, project, { id: 'operator-admin-1', role: 'Operator Admin', operatorId: 'operator-1' }), ['approve', 'reject']);
  assert.deepEqual(getWorkPassActions(second, project, { id: 'operator-admin-1', role: 'Operator Admin', operatorId: 'operator-1' }), ['second-approve', 'reject']);
  const focal = { id: 'manager-1', role: 'Manager', operatorId: 'operator-1', focalCompanyIds: ['galfar'] };
  assert.deepEqual(getWorkPassActions(submitted, project, focal), ['approve', 'reject']);
  assert.deepEqual(getWorkPassActions(second, project, focal), ['second-approve', 'reject']);
  // A manager who is not the submitting company's focal point sees the request but does not decide it.
  const otherManager = { id: 'manager-2', role: 'Manager', operatorId: 'operator-1', focalCompanyIds: ['consultant-company-1'] };
  assert.deepEqual(getWorkPassActions(submitted, project, otherManager), []);
  assert.deepEqual(getWorkPassActions(second, project, otherManager), []);
  assert.deepEqual(getWorkPassActions(submitted, project, { id: 'admin-1', role: 'Admin' }), []);
});

test('on a project with an approving manager, only that manager (or an operator admin) decides', () => {
  const withManager = { ...project, approvingManagerUserId: 'project-manager' };
  const submitted = { id: 'wp-2', projectId: 'project-1', status: 'Submitted', submittedByUserId: 'contractor-1', submittingContractorId: 'galfar' } as CommandCenterWorkPass;
  const second = { ...submitted, status: 'PendingSecondApproval' };
  const projectManager = { id: 'project-manager', role: 'Manager', operatorId: 'operator-1', focalCompanyIds: [] };
  const focal = { id: 'manager-1', role: 'Manager', operatorId: 'operator-1', focalCompanyIds: ['galfar'] };
  assert.deepEqual(getWorkPassActions(submitted, withManager, projectManager), ['approve', 'reject']);
  assert.deepEqual(getWorkPassActions(second, withManager, projectManager), ['second-approve', 'reject']);
  assert.deepEqual(getWorkPassActions(second, withManager, focal), []);
  assert.deepEqual(getWorkPassActions(second, withManager, { id: 'operator-admin-1', role: 'Operator Admin', operatorId: 'operator-1' }), ['second-approve', 'reject']);
});

test('pending second approval uses the operator approval label', () => {
  assert.equal(getWorkPassStatusPresentation('PendingSecondApproval').label, 'Pending operator approval');
  assert.match(workPassDetailSource, /getWorkPassStatusPresentation\(request\.status\)/);
  assert.match(reportsPageSource, /getWorkPassStatusPresentation\(row\.accessStatus\)/);
});

test('worker compliance includes onboarding clearance as well as job credentials', () => {
  assert.equal(isWorkerComplianceSatisfied(true, 'Pending'), false);
  assert.equal(isWorkerComplianceSatisfied(true, 'Cleared'), true);
  assert.equal(isWorkerComplianceSatisfied(false, 'Cleared'), false);
});

test('the worker badge never reads an unchecked worker as compliant', () => {
  assert.deepEqual(
    [workerComplianceBadge(null, 'Cleared').label, workerComplianceBadge(undefined, 'Cleared').compliant],
    ['Not checked', false],
  );
});

test('the worker badge separates awaiting verification from non-compliance', () => {
  assert.equal(workerComplianceBadge(true, 'Cleared').label, 'Compliant');
  assert.equal(workerComplianceBadge(true, 'Pending').label, 'Awaiting verification');
  assert.equal(workerComplianceBadge(true, 'UnderReview').label, 'Awaiting verification');
  assert.equal(workerComplianceBadge(true, 'Returned').label, 'Non-compliant');
  assert.equal(workerComplianceBadge(false, 'Cleared').label, 'Non-compliant');
  assert.equal(workerComplianceBadge(false, 'Pending').label, 'Non-compliant');
});

test('the request page uses the shared badge and treats a failed check as unknown', () => {
  assert.match(workPassDetailSource, /workerComplianceBadge\(/);
  assert.doesNotMatch(workPassDetailSource, /\(\) => \[item\.userId, true\]/);
});

test('workflow stages show the live queue instead of claiming access is granted', () => {
  const stages = getProjectWorkflowStages(project, [
    { id: 'wp-1', status: 'Submitted', submittedByUserId: 'contractor-1' } as CommandCenterWorkPass,
  ]);
  assert.equal(stages.find((stage) => stage.id === 'consultant-access')?.state, 'current');
  assert.equal(stages.find((stage) => stage.id === 'access-granted')?.state, 'upcoming');
  assert.deepEqual(stages.map((stage) => stage.id), [
    'contractor-preparation',
    'consultant-access',
    'supervisor-access',
    'access-granted',
  ]);
  assert.equal(stages.length, 4);
});

test('access-request work-pass queue exposes verifier and Operator Admin decisions', () => {
  const submitted = { id: 'wp-1', projectId: project.id, status: 'Submitted', submittedByUserId: 'contractor-1' } as CommandCenterWorkPass;
  const secondApproval = { id: 'wp-2', projectId: project.id, status: 'PendingSecondApproval', submittedByUserId: 'contractor-1' } as CommandCenterWorkPass;

  const consultantQueue = getWorkPassQueueItems(
    [submitted, secondApproval],
    [project],
    { id: 'supervisor-1', role: 'Supervisor', contractorId: 'consultant-company-1' },
  );
  const operatorQueue = getWorkPassQueueItems(
    [submitted, secondApproval],
    [project],
    { id: 'operator-admin-1', role: 'Operator Admin', operatorId: 'operator-1' },
  );

  assert.deepEqual(consultantQueue.map((item) => item.actions), [['approve', 'reject'], []]);
  assert.deepEqual(operatorQueue.map((item) => item.actions), [['approve', 'reject'], ['second-approve', 'reject']]);
  assert.equal(consultantQueue[0]?.project?.name, 'North Field Upgrade');
});
