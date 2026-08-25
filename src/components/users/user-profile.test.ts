import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's built-in TypeScript runner requires the source extension.
import { isMaskedIdentityNumber, normalizeUserProfile } from '../../lib/user-profile.ts';

test('API identity and employer fields are normalized for personnel views', () => {
  const user = normalizeUserProfile({
    id: 'worker-1',
    name: 'Worker One',
    email: 'worker@example.com',
    role: 'Worker',
    status: 'Active',
    identityNumber: '******1234',
    employerName: 'Nama Water Services',
    nationality: 'Omani',
  });

  assert.equal(user.idNumber, '******1234');
  assert.equal(user.company, 'Nama Water Services');
  assert.equal(user.nationality, 'Omani');
});

test('masked national IDs are recognized so edits do not overwrite stored values', () => {
  assert.equal(isMaskedIdentityNumber('******1234'), true);
  assert.equal(isMaskedIdentityNumber('12345678'), false);
  assert.equal(isMaskedIdentityNumber(''), false);
});

test('already-normalized user fields are preserved', () => {
  const user = normalizeUserProfile({
    id: 'worker-2',
    name: 'Worker Two',
    email: 'worker2@example.com',
    role: 'Worker',
    idNumber: 'existing-id',
    identityNumber: 'api-id',
    company: 'Existing company',
    employerName: 'API company',
  });

  assert.equal(user.idNumber, 'existing-id');
  assert.equal(user.company, 'Existing company');
});
