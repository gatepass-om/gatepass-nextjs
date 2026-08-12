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
  assert.equal(canIssuePersonnelCard('Consultant'), false);
});
