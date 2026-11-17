import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's built-in TypeScript runner requires the source extension.
import { createLatestRequestCoordinator, getDashboardFreshness } from './dashboard-refresh.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test('only the newest concurrent request is accepted and requests stay bounded', async () => {
  const coordinator = createLatestRequestCoordinator();
  const olderDeferred = deferred<string>();
  const newerDeferred = deferred<string>();
  const started: string[] = [];

  const older = coordinator.run(() => {
    started.push('older');
    return olderDeferred.promise;
  }, 'older-scope');
  const newer = coordinator.run(() => {
    started.push('newer');
    return newerDeferred.promise;
  }, 'newer-scope');

  assert.deepEqual(started, ['older']);

  olderDeferred.resolve('stale scope');
  assert.deepEqual(await older, { status: 'stale' });
  assert.deepEqual(started, ['older', 'newer']);

  newerDeferred.resolve('newest scope');
  assert.deepEqual(await newer, { status: 'accepted', value: 'newest scope' });
});

test('a burst keeps only one active and the newest trailing request', async () => {
  const coordinator = createLatestRequestCoordinator();
  const activeDeferred = deferred<string>();
  const trailingDeferred = deferred<string>();
  const started: string[] = [];

  const active = coordinator.run(() => {
    started.push('active');
    return activeDeferred.promise;
  }, 'same-scope');
  const replaced = coordinator.run(async () => {
    started.push('replaced');
    return 'should not run';
  }, 'same-scope');
  const trailing = coordinator.run(() => {
    started.push('trailing');
    return trailingDeferred.promise;
  }, 'same-scope');

  assert.deepEqual(await replaced, { status: 'stale' });
  assert.deepEqual(started, ['active']);

  activeDeferred.resolve('old');
  assert.deepEqual(await active, { status: 'accepted', value: 'old' });
  assert.deepEqual(started, ['active', 'trailing']);

  trailingDeferred.resolve('current');
  assert.deepEqual(await trailing, { status: 'accepted', value: 'current' });
});

test('invalidating the coordinator rejects an in-flight principal response as stale', async () => {
  const coordinator = createLatestRequestCoordinator();
  const requestDeferred = deferred<string>();
  const request = coordinator.run(() => requestDeferred.promise);

  coordinator.invalidate();
  requestDeferred.resolve('previous principal');

  assert.deepEqual(await request, { status: 'stale' });
});

test('a stale request failure cannot replace the newest request state', async () => {
  const coordinator = createLatestRequestCoordinator();
  const olderDeferred = deferred<string>();
  const newerDeferred = deferred<string>();

  const older = coordinator.run(() => olderDeferred.promise, 'older-scope');
  const newer = coordinator.run(() => newerDeferred.promise, 'newer-scope');

  olderDeferred.reject(new Error('old request failed'));
  assert.deepEqual(await older, { status: 'stale' });

  newerDeferred.resolve('current scope');
  assert.deepEqual(await newer, { status: 'accepted', value: 'current scope' });
});

test('freshness changes when the clock crosses the stale threshold without a response', () => {
  const generatedAtUtc = '2026-08-24T10:00:00.000Z';
  const generatedAt = Date.parse(generatedAtUtc);

  assert.deepEqual(
    getDashboardFreshness(generatedAt + 119_999, generatedAtUtc, false),
    { isStale: false, message: null },
  );
  assert.deepEqual(
    getDashboardFreshness(generatedAt + 120_001, generatedAtUtc, false),
    { isStale: true, message: 'Data may be stale' },
  );
});

test('a failed refresh warns while preserving the last successful summary', () => {
  const generatedAtUtc = '2026-08-24T10:00:00.000Z';
  const generatedAt = Date.parse(generatedAtUtc);

  assert.deepEqual(
    getDashboardFreshness(generatedAt + 30_000, generatedAtUtc, true),
    { isStale: true, message: 'Refresh failed · showing last successful data' },
  );
});
