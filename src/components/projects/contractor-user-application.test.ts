import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
  new URL('../../app/(app)/contractor-user-applications/page.tsx', import.meta.url),
  'utf8',
);

test('failed submissions remain recoverable as editable drafts', () => {
  assert.match(source, /setEditingId\(saved\.id\)/);
  assert.match(source, /\['Draft', 'Returned'\]\.includes\(item\.status\)/);
  assert.match(source, /Continue draft/);
});

test('the redundant private-document upload is not offered in the approval form', () => {
  assert.doesNotMatch(source, /Private document/);
  assert.doesNotMatch(source, /setPrivateFile/);
});

test('applications support configured choices, assignments, and server pagination', () => {
  assert.match(source, /getContractorUserApplicationOptions/);
  assert.match(source, /supervisorUserId/);
  assert.match(source, /reviewerUserId/);
  assert.match(source, /totalPages/);
  assert.match(source, /updateContractorUserApplicationOptions/);
});
