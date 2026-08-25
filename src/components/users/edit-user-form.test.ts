import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const editSource = readFileSync(new URL('./edit-user-form.tsx', import.meta.url), 'utf8');
const tableSource = readFileSync(new URL('./users-table.tsx', import.meta.url), 'utf8');

test('the edit-user form omits legacy communication and usage preferences', () => {
  assert.doesNotMatch(editSource, /Communication and assistance/);
  assert.doesNotMatch(editSource, /Easiest way to use GatePass/);
  assert.doesNotMatch(editSource, /preferredInteractionMode:\s*z\.enum/);
  assert.doesNotMatch(editSource, /needsAssistedWorkflow:\s*z\.boolean/);
});

test('the edit-user form requires national ID and email', () => {
  assert.match(editSource, /idNumber:\s*z\.string\(\)\.trim\(\)\.min\(/);
  assert.match(editSource, /email:\s*z\.string\(\)\.trim\(\)\.email\(/);
  assert.match(editSource, /<FormLabel>National ID number \*<\/FormLabel>/);
  assert.match(editSource, /<FormLabel>Email address \*<\/FormLabel>/);
});

test('company assignment is viewer-scoped and only shown for company administrator roles', () => {
  assert.match(editSource, /currentUser:\s*User/);
  assert.match(tableSource, /currentUser=\{currentUser\}/);
  assert.match(
    editSource,
    /selectedRole === ['"]Contractor Admin['"]\s*&&\s*currentUser\.role === ['"]Admin['"]/,
  );
});
