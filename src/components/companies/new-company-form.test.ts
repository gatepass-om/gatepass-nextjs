import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./new-company-form.tsx', import.meta.url), 'utf8');

test('contractor registration includes company, focal point and final review steps', () => {
  assert.match(source, /Company details/);
  assert.match(source, /'Focal point'/);
  assert.match(source, /Review & submit/);
});

test('contractor registration no longer creates a contractor administrator', () => {
  assert.doesNotMatch(source, /Admin details/);
  assert.doesNotMatch(source, /adminName/);
  assert.doesNotMatch(source, /adminEmail/);
  assert.doesNotMatch(source, /invite admin/i);
});

test('the focal point is chosen from active managers of the registering operator', () => {
  assert.match(source, /manager\.role === 'Manager'/);
  assert.match(source, /manager\.status === 'Active'/);
  assert.match(source, /manager\.operatorId === selectedOperatorId/);
  assert.match(source, /focalPointUserId: registeringAsFocalPoint \|\| subcontractorRegistrationOnly \? undefined/);
});

test('contractor registration does not ask for contract details', () => {
  assert.doesNotMatch(source, /Contract details/);
  assert.doesNotMatch(source, /contractNumber/);
  assert.doesNotMatch(source, /contractValidFrom/);
  assert.doesNotMatch(source, /contractValidTo/);
});
