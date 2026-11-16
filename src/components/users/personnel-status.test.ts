import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's built-in TypeScript runner requires the source extension.
import { daysUntil, matchesCredentialFilter, personnelStatus } from './personnel-status.ts';

const today = new Date('2026-11-16T09:00:00Z');
const worker = (over: Record<string, unknown> = {}) => ({ id: 'u1', name: 'A', role: 'Worker', ...over }) as any;

test('a card is still good on its last day', () => {
  assert.equal(daysUntil('2026-11-16T23:59:59Z', today), 0);
  const status = personnelStatus(worker({ idExpiresAtUtc: '2026-11-16T23:59:59Z' }), today);
  assert.equal(status.state, 'Expiring');
  assert.equal(status.detail, 'Identity document expires today');
});

test('yesterday is expired, and says how long ago', () => {
  const status = personnelStatus(worker({ idExpiresAtUtc: '2026-11-13T23:59:59Z' }), today);
  assert.equal(status.state, 'Expired');
  assert.equal(status.detail, 'Identity document expired 3 days ago');
  assert.equal(status.daysRemaining, -3);
});

test('the worst document decides, and the row names it', () => {
  const status = personnelStatus(
    worker({
      idExpiresAtUtc: '2027-11-16T23:59:59Z',
      certificates: [{ id: 'c', certificateTypeId: 't', name: 'HSE Induction', expiresAtUtc: '2026-11-21T20:00:00Z' }],
    }),
    today,
  );
  assert.equal(status.state, 'Expiring');
  assert.equal(status.detail, 'HSE Induction expires in 5 days');
});

test('an expired certificate outranks an identity document that is merely close', () => {
  const status = personnelStatus(
    worker({
      idExpiresAtUtc: '2026-11-20T23:59:59Z',
      certificates: [{ id: 'c', certificateTypeId: 't', name: 'Confined Space', expiresAtUtc: '2026-11-01T20:00:00Z' }],
    }),
    today,
  );
  assert.equal(status.state, 'Expired');
  assert.equal(status.detail, 'Confined Space expired 15 days ago');
});

test('everything far out reads as in order', () => {
  const status = personnelStatus(worker({ idExpiresAtUtc: '2027-11-16T23:59:59Z' }), today);
  assert.equal(status.state, 'Valid');
});

test('a worker with nothing on file reads as missing, and a non-worker does not', () => {
  assert.equal(personnelStatus(worker(), today).state, 'Missing');
  assert.equal(personnelStatus(worker({ role: 'Manager' }), today).state, 'None');
});

test('the Today page filters select exactly their own rows', () => {
  const expired = personnelStatus(worker({ idExpiresAtUtc: '2026-11-01T23:59:59Z' }), today);
  const soon = personnelStatus(worker({ idExpiresAtUtc: '2026-11-20T23:59:59Z' }), today);
  const later = personnelStatus(worker({ idExpiresAtUtc: '2026-12-10T23:59:59Z' }), today);

  assert.equal(matchesCredentialFilter(expired, 'Expired', null), true);
  assert.equal(matchesCredentialFilter(soon, 'Expired', null), false);

  // "Next 7 days" must not sweep in the 8-to-30 band.
  assert.equal(matchesCredentialFilter(soon, 'Expiring', 7), true);
  assert.equal(matchesCredentialFilter(later, 'Expiring', 7), false);
  assert.equal(matchesCredentialFilter(later, 'Expiring', 30), true);

  // An expired document is not "expiring": the two Today rows never double-count a person.
  assert.equal(matchesCredentialFilter(expired, 'Expiring', 30), false);

  assert.equal(matchesCredentialFilter(expired, null, null), true);
});
