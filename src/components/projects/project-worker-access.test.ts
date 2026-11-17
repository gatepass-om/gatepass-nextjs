import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's built-in TypeScript runner requires the source extension.
import { getEligibleProjectWorkers } from './project-worker-access.ts';

const workers = [
  { id: 'worker-1', name: 'Aisha Al-Balushi', role: 'Worker' as const, contractorId: 'contractor-a', idNumber: 'OM-001' },
  { id: 'worker-2', name: 'Rashid Al-Harthy', role: 'Worker' as const, contractorId: 'contractor-a', email: 'rashid@example.test' },
  { id: 'worker-3', name: 'Other Contractor Worker', role: 'Worker' as const, contractorId: 'contractor-b' },
  { id: 'supervisor-1', name: 'Aisha Supervisor', role: 'Supervisor' as const, contractorId: 'contractor-a' },
];

test('contractor supervisor can filter their complete worker directory, not only the existing project roster', () => {
  const result = getEligibleProjectWorkers(workers, 'contractor-a', 'om-001', [], false);

  assert.deepEqual(result.map((worker) => worker.id), ['worker-1']);
});

test('selected-only filter keeps the request list manageable for large crews', () => {
  const result = getEligibleProjectWorkers(workers, 'contractor-a', '', ['worker-2'], true);

  assert.deepEqual(result.map((worker) => worker.id), ['worker-2']);
});
