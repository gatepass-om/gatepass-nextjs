import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's built-in TypeScript runner requires the source extension.
import { daysUntil, describeUrlFilter, matchesCredentialFilter, matchesUrlFilter, personnelStatus, personnelUrlFilter } from './personnel-status.ts';

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

test('a good certificate does not make a worker with no identity document look in order', () => {
  // The gate refuses them whatever their training says, so the register must not disagree with it.
  const status = personnelStatus(
    worker({ certificates: [{ id: 'c', certificateTypeId: 't', name: 'HSE Induction', expiresAtUtc: '2027-11-16T20:00:00Z' }] }),
    today,
  );
  assert.equal(status.state, 'Missing');
  assert.equal(status.detail, 'No identity document on file');
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

const params = (query: string) => {
  const map = new URLSearchParams(query);
  return (key: string) => map.get(key);
};

test("every link Today sends is recognised, and the two the page cannot serve say so", () => {
  assert.deepEqual(personnelUrlFilter(params('credentialStatus=Expired')), { kind: 'credential', value: 'Expired', withinDays: null });
  assert.deepEqual(personnelUrlFilter(params('credentialStatus=Expiring&within=7')), { kind: 'credential', value: 'Expiring', withinDays: 7 });
  assert.deepEqual(personnelUrlFilter(params('clearanceStatus=Returned')), { kind: 'clearance', value: 'Returned' });
  assert.deepEqual(personnelUrlFilter(params('identityStatus=Unverified')), { kind: 'identity' });
  assert.deepEqual(personnelUrlFilter(params('competencyStatus=Expiring')), { kind: 'competency', withinDays: 30 });
  assert.equal(personnelUrlFilter(params('documentStatus=Pending')).kind, 'unsupported');
  assert.equal(personnelUrlFilter(params('cardStatus=Issued')).kind, 'unsupported');
  assert.deepEqual(personnelUrlFilter(params('')), { kind: 'none' });
  // A value the page does not know must not quietly become a filter that hides everyone.
  assert.deepEqual(personnelUrlFilter(params('credentialStatus=Nonsense')), { kind: 'none' });
});

test('each filter picks its own people', () => {
  const returned = worker({ clearanceStatus: 'Returned' });
  const cleared = worker({ clearanceStatus: 'Cleared' });
  const clearance = { kind: 'clearance', value: 'Returned' } as const;
  assert.equal(matchesUrlFilter(returned, personnelStatus(returned, today), clearance, today), true);
  assert.equal(matchesUrlFilter(cleared, personnelStatus(cleared, today), clearance, today), false);

  // The identity expiry column is only written from a verified document, so its absence is the count.
  const unverified = worker();
  const verified = worker({ idExpiresAtUtc: '2027-11-16T23:59:59Z' });
  assert.equal(matchesUrlFilter(unverified, personnelStatus(unverified, today), { kind: 'identity' }, today), true);
  assert.equal(matchesUrlFilter(verified, personnelStatus(verified, today), { kind: 'identity' }, today), false);

  const soon = worker({ certificates: [{ id: 'c', certificateTypeId: 't', name: 'HSE', expiresAtUtc: '2026-12-01T20:00:00Z' }] });
  const far = worker({ certificates: [{ id: 'c', certificateTypeId: 't', name: 'HSE', expiresAtUtc: '2027-12-01T20:00:00Z' }] });
  const gone = worker({ certificates: [{ id: 'c', certificateTypeId: 't', name: 'HSE', expiresAtUtc: '2026-01-01T20:00:00Z' }] });
  const competency = { kind: 'competency', withinDays: 30 } as const;
  assert.equal(matchesUrlFilter(soon, personnelStatus(soon, today), competency, today), true);
  assert.equal(matchesUrlFilter(far, personnelStatus(far, today), competency, today), false);
  // Already expired is a different row on Today; it must not be swept in here too.
  assert.equal(matchesUrlFilter(gone, personnelStatus(gone, today), competency, today), false);

  // An unsupported filter shows everyone rather than an empty page pretending to be a result.
  assert.equal(matchesUrlFilter(far, personnelStatus(far, today), { kind: 'unsupported', what: 'x' }, today), true);
});

test('the server saying a clearance has lapsed overrules what the dates say', () => {
  // Dates alone would call this worker "in order": identity good for a year, no certificates.
  const lapsed = worker({
    idExpiresAtUtc: '2027-11-16T23:59:59Z',
    effectiveClearanceStatus: 'Lapsed',
    clearanceLapsedReasons: ['HSE Induction: Missing', 'Photo: Rejected'],
  });
  const status = personnelStatus(lapsed, today);

  assert.equal(status.state, 'Lapsed');
  assert.equal(status.detail, 'HSE Induction: Missing (+1 more)');
  assert.equal(matchesCredentialFilter(status, 'Lapsed', null), true);
  assert.equal(matchesCredentialFilter(status, 'Valid', null), false);
});

test('without a verdict the dates still decide, and a non-lapsed verdict changes nothing', () => {
  const noVerdict = personnelStatus(worker({ idExpiresAtUtc: '2027-11-16T23:59:59Z' }), today);
  const cleared = personnelStatus(worker({ idExpiresAtUtc: '2027-11-16T23:59:59Z', effectiveClearanceStatus: 'Cleared' }), today);

  assert.equal(noVerdict.state, 'Valid');
  assert.equal(cleared.state, 'Valid');
});

test('a worker whose papers are waiting for review says so, not that nothing is on file', () => {
  const waiting = worker({ documentsAwaitingReview: 2 });
  const status = personnelStatus(waiting, today);
  assert.equal(status.state, 'Pending');
  assert.equal(status.detail, '2 documents waiting for review');
  // Nothing submitted at all is still Missing.
  assert.equal(personnelStatus(worker(), today).state, 'Missing');
});
