import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
  new URL('../../app/(app)/users/[id]/page.tsx', import.meta.url),
  'utf8',
);

test('the personnel profile route displays identity details and a managed worker profile photo', () => {
  assert.match(source, /<WorkerProfilePhoto/);
  assert.match(source, /fallbackUrl=\{user\.avatarUrl\}/);
  assert.match(source, /canEdit=\{canEdit && user\.role === 'Worker'\}/);
  assert.match(source, /user\.name/);
  assert.match(source, /user\.email/);
  assert.match(source, /user\.role/);
  assert.match(source, /user\.status/);
});

test('the personnel profile route loads the selected record and supports editing it', () => {
  assert.match(source, /listUsersRequest/);
  assert.match(source, /usersData\.find\(\(person\) => person\.id === personnelId\)/);
  assert.match(source, /<EditUserForm/);
  assert.match(source, /updateUserRequest/);
  assert.match(source, /setUser\(updated\)/);
});

test('company-scoped administrators never fall back to an unscoped personnel request', () => {
  assert.match(source, /currentUser\.role === 'Operator Admin' && !currentUser\.operatorId/);
  assert.match(source, /currentUser\.role === 'Contractor Admin' && !currentUser\.contractorId/);
});
