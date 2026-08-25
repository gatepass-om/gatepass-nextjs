import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's built-in TypeScript runner requires the source extension.
import { resolveEditAffiliation } from './user-affiliation.ts';

test('changing to contractor admin clears an operator affiliation', () => {
  assert.deepEqual(resolveEditAffiliation({
    role: 'Contractor Admin',
    originalOperatorId: 'operator-1',
    selectedContractorId: 'contractor-1',
  }), { operatorId: null, contractorId: 'contractor-1' });
});

test('changing to an operator role clears a contractor affiliation', () => {
  assert.deepEqual(resolveEditAffiliation({
    role: 'Manager',
    originalContractorId: 'contractor-1',
    selectedOperatorId: 'operator-1',
  }), { operatorId: 'operator-1', contractorId: null });
});

test('editing personnel preserves their existing company ownership', () => {
  assert.deepEqual(resolveEditAffiliation({
    role: 'Worker',
    originalOperatorId: 'operator-1',
  }), { operatorId: 'operator-1', contractorId: null });
  assert.deepEqual(resolveEditAffiliation({
    role: 'Supervisor',
    originalContractorId: 'contractor-1',
  }), { operatorId: null, contractorId: 'contractor-1' });
});
