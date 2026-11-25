import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's built-in TypeScript runner requires the source extension.
import { canIssuePersonnelCard, shouldLoadPersonnelSites } from './user-actions.ts';

test('contractor administrators do not load the operator site directory', () => {
  assert.equal(shouldLoadPersonnelSites('Contractor Admin'), false);
});

test('operator-side personnel administrators retain site data', () => {
  assert.equal(shouldLoadPersonnelSites('Admin'), true);
  assert.equal(shouldLoadPersonnelSites('Operator Admin'), true);
});

test('authorized administrators can issue a credential regardless of the cardholder role', () => {
  for (const role of ['Admin', 'Operator Admin', 'Contractor Admin'] as const) {
    assert.equal(canIssuePersonnelCard(role), true);
  }
});

test('non-administrative roles cannot issue credentials', () => {
  assert.equal(canIssuePersonnelCard('Manager'), false);
  assert.equal(canIssuePersonnelCard('Supervisor'), false);
});

test('supervisors edit their own company workers, not other companies or supervisors', async () => {
  // @ts-expect-error Node's built-in TypeScript runner requires the source extension.
  const { canEditPersonRecord } = await import('./user-actions.ts');
  const supervisor = { role: 'Supervisor', contractorId: 'galfar' } as const;
  assert.equal(canEditPersonRecord(supervisor, { role: 'Worker', contractorId: 'galfar' }), true);
  assert.equal(canEditPersonRecord(supervisor, { role: 'Worker', contractorId: 'other' }), false);
  assert.equal(canEditPersonRecord(supervisor, { role: 'Supervisor', contractorId: 'galfar' }), false);
});

test('a focal point edits company supervisors and operator admins do not edit contractor workers', async () => {
  // @ts-expect-error Node's built-in TypeScript runner requires the source extension.
  const { canEditPersonRecord, editableRolesFor } = await import('./user-actions.ts');
  assert.equal(canEditPersonRecord({ role: 'Manager' }, { role: 'Supervisor', contractorId: 'galfar' }), true);
  assert.equal(canEditPersonRecord({ role: 'Manager' }, { role: 'Worker', contractorId: 'galfar' }), false);
  assert.equal(canEditPersonRecord({ role: 'Operator Admin' }, { role: 'Worker', contractorId: 'galfar' }), false);
  assert.equal(canEditPersonRecord({ role: 'Operator Admin' }, { role: 'Supervisor', contractorId: 'galfar' }), true);
  assert.deepEqual(editableRolesFor({ role: 'Supervisor', contractorId: 'galfar' }, { role: 'Worker', contractorId: 'galfar' }), ['Worker', 'Visitor']);
  assert.deepEqual(editableRolesFor({ role: 'Manager' }, { role: 'Supervisor', contractorId: 'galfar' }), ['Supervisor']);
});
