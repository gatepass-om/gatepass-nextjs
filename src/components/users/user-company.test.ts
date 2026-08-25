import assert from 'node:assert/strict';
import test from 'node:test';

// @ts-expect-error Node's built-in TypeScript runner requires the source extension.
import { resolveUserCompanyName } from './user-company.ts';

const contractors = [{ id: 'contractor-1', name: 'Delivery Co' }];
const operators = [{ id: 'operator-1', name: 'Nama Water Services' }];

test('operator personnel display their operator company', () => {
  assert.equal(
    resolveUserCompanyName(
      { operatorId: 'operator-1', contractorId: null, company: null },
      contractors,
      operators,
    ),
    'Nama Water Services',
  );
});

test('contractor personnel display their contractor company', () => {
  assert.equal(
    resolveUserCompanyName(
      { operatorId: null, contractorId: 'contractor-1', company: null },
      contractors,
      operators,
    ),
    'Delivery Co',
  );
});

test('unaffiliated personnel use a clear label instead of N/A', () => {
  assert.equal(
    resolveUserCompanyName(
      { operatorId: null, contractorId: null, company: null },
      contractors,
      operators,
    ),
    'Not assigned',
  );
});
