import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's built-in TypeScript runner requires the source extension.
import { getProjectActions, getProjectWorkflowStages, getWorkPassActions, type CommandCenterProject, type CommandCenterWorkPass } from './project-command-center.ts';

const project: CommandCenterProject = {
  id: 'project-1',
  name: 'North Field Upgrade',
  status: 'Active',
  supervisorUserId: 'supervisor-1',
  consultantUserId: 'consultant-1',
  consultantApprovedAtUtc: '2026-08-01T08:00:00Z',
};

test('work-pass actions follow contractor, consultant, then supervisor approval stages', () => {
  const draft = { id: 'wp-1', status: 'Draft', submittedByUserId: 'contractor-1' } as CommandCenterWorkPass;
  const submitted = { ...draft, status: 'Submitted' };
  const second = { ...draft, status: 'PendingSecondApproval' };

  assert.deepEqual(getWorkPassActions(draft, project, { id: 'contractor-1', role: 'Supervisor' }), ['submit']);
  assert.deepEqual(getWorkPassActions(submitted, project, { id: 'consultant-1', role: 'Consultant' }), ['approve', 'reject']);
  assert.deepEqual(getWorkPassActions(second, project, { id: 'supervisor-1', role: 'Supervisor' }), ['second-approve', 'reject']);
  assert.deepEqual(getWorkPassActions(submitted, project, { id: 'admin-1', role: 'Admin' }), []);
});

test('only the assigned supervisor can resubmit a rejected project', () => {
  const rejected = { ...project, status: 'Rejected' };
  assert.deepEqual(getProjectActions(rejected, { id: 'supervisor-1', role: 'Supervisor' }), ['resubmit']);
  assert.deepEqual(getProjectActions(rejected, { id: 'admin-1', role: 'Admin' }), []);
});

test('workflow stages show the live queue instead of claiming access is granted', () => {
  const stages = getProjectWorkflowStages(project, [
    { id: 'wp-1', status: 'Submitted', submittedByUserId: 'contractor-1' } as CommandCenterWorkPass,
  ]);
  assert.equal(stages.find((stage) => stage.id === 'consultant-access')?.state, 'current');
  assert.equal(stages.find((stage) => stage.id === 'access-granted')?.state, 'upcoming');
});
