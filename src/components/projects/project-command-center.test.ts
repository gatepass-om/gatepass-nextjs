import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's built-in TypeScript runner requires the source extension.
import { getProjectWorkflowStages, getWorkPassActions, getWorkPassQueueItems, type CommandCenterProject, type CommandCenterWorkPass } from './project-command-center.ts';

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

test('work-pass actions follow contractor, consultant verification, then Operator Admin decision', () => {
  const draft = { id: 'wp-1', status: 'Draft', submittedByUserId: 'contractor-1' } as CommandCenterWorkPass;
  const submitted = { ...draft, status: 'Submitted' };
  const second = { ...draft, status: 'PendingSecondApproval' };

  assert.deepEqual(getWorkPassActions(draft, project, { id: 'contractor-1', role: 'Supervisor' }), ['submit']);
  assert.deepEqual(getWorkPassActions(submitted, project, { id: 'consultant-reviewer-1', role: 'Contractor Admin' }), []);
  assert.deepEqual(getWorkPassActions(submitted, project, { id: 'supervisor-1', role: 'Supervisor' }), []);
  assert.deepEqual(getWorkPassActions(submitted, project, { id: 'supervisor-1', role: 'Supervisor', contractorId: 'consultant-company-1' }), ['approve', 'reject']);
  assert.deepEqual(getWorkPassActions(submitted, project, { id: 'operator-admin-1', role: 'Operator Admin', operatorId: 'operator-1' }), ['approve', 'reject']);
  assert.deepEqual(getWorkPassActions(second, project, { id: 'operator-admin-1', role: 'Operator Admin', operatorId: 'operator-1' }), ['second-approve', 'reject']);
  assert.deepEqual(getWorkPassActions(submitted, project, { id: 'admin-1', role: 'Admin' }), []);
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
