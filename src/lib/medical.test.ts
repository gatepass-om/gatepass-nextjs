import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's built-in TypeScript runner requires the source extension.
import { gatingModeOf, canConfigureMedicalGating, canRecordMedical, canReviewMedical, medicalOutcomeLabel, medicalRows, restrictionLabel, validateMedicalForm } from './medical.ts';

const ok = {
  typeId: 't1', outcome: 1, restrictions: [] as string[], issueDate: '2026-11-01', expiryDate: '2027-11-01',
  number: 'CERT-1', issuer: 'Muscat Occupational Health', attested: true,
  typeExpires: true, typeDefaultValidityDays: null,
  typeRequiresNumber: true, typeRequiresIssuer: true, typeRequiresIssueDate: true,
};

test('a complete form has nothing wrong with it', () => {
  assert.deepEqual(validateMedicalForm(ok), []);
});

test('whatever the kind of record demands, the form insists on it (the server refuses a submission without)', () => {
  const says = (over: Record<string, unknown>) => validateMedicalForm({ ...ok, ...over }).join(' | ');
  assert.match(says({ number: '' }), /certificate number/);
  assert.match(says({ issuer: '  ' }), /issued it/);
  assert.match(says({ issueDate: '' }), /issue date/);
  // A kind that does not ask for them does not get pestered for them.
  assert.deepEqual(validateMedicalForm({
    ...ok, number: '', issuer: '', issueDate: '', typeRequiresNumber: false, typeRequiresIssuer: false, typeRequiresIssueDate: false,
  }), []);
});

test('fit-with-restrictions needs restrictions, and no other outcome may carry any', () => {
  assert.ok(validateMedicalForm({ ...ok, outcome: 2 }).some((p: string) => p.includes('at least one restriction')));
  assert.deepEqual(validateMedicalForm({ ...ok, outcome: 2, restrictions: ['NoDriving'] }), []);
  assert.ok(validateMedicalForm({ ...ok, outcome: 3, restrictions: ['NoDriving'] }).some((p: string) => p.includes('only apply')));
});

test('an expiring type needs an expiry, unless the type can derive one from the issue date', () => {
  assert.ok(validateMedicalForm({ ...ok, expiryDate: '' }).some((p: string) => p.includes('expiry')));
  assert.deepEqual(validateMedicalForm({ ...ok, expiryDate: '', typeDefaultValidityDays: 365 }), []);
  assert.ok(validateMedicalForm({ ...ok, expiryDate: '', issueDate: '', typeDefaultValidityDays: 365 }).some((p: string) => p.includes('expiry')));
});

test('expiry before issue is refused, and so is a record nobody has seen the original of', () => {
  assert.ok(validateMedicalForm({ ...ok, expiryDate: '2026-10-01' }).some((p: string) => p.includes('before the issue')));
  assert.ok(validateMedicalForm({ ...ok, attested: false }).some((p: string) => p.includes('original certificate')));
});

test('the outcome and the restriction read as words', () => {
  assert.equal(medicalOutcomeLabel(3), 'Unfit');
  assert.equal(medicalOutcomeLabel(null), '—');
  assert.equal(restrictionLabel('NoWorkAtHeight'), 'No work at height');
  assert.equal(restrictionLabel('OfficeDutiesOnly'), 'Office duties only');
});

test('a contractor records, the operator side decides, and only an administrator configures', () => {
  assert.equal(canRecordMedical('Contractor Admin'), true);
  assert.equal(canReviewMedical('Contractor Admin'), false);
  assert.equal(canReviewMedical('Manager'), true);
  assert.equal(canRecordMedical('Security'), false);
  assert.equal(canConfigureMedicalGating('Manager'), false);
  assert.equal(canConfigureMedicalGating('Operator Admin'), true);
});

test('medical rows come from required types and from recorded documents nothing requires', () => {
  const rows = medicalRows({
    requirements: [
      { documentTypeId: 'a', documentTypeName: 'Periodic medical fitness', category: 2, enforcement: 1, state: 'Barred', medicalOutcome: 3, restrictions: [], expiryDate: '2027-01-01' },
      { documentTypeId: 'b', documentTypeName: 'Civil ID', category: 1, enforcement: 1, state: 'Valid', restrictions: [] },
    ],
    otherDocuments: [
      { id: 'd1', typeName: 'Vaccination record', category: 2, reviewStatus: 3, medicalOutcome: 1, restrictions: [], expiryDate: '2028-01-01' },
      { id: 'd2', typeName: 'Passport', category: 1, reviewStatus: 3, restrictions: [] },
    ],
  });
  assert.deepEqual(rows.map((r: { title: string }) => r.title), ['Periodic medical fitness', 'Vaccination record']);
  assert.equal(rows[0].blocking, true);
  assert.equal(rows[0].state, 'Barred');
  // Recorded but required by nothing: visible, and honest that it enforces nothing.
  assert.equal(rows[1].blocking, null);
  assert.equal(rows[1].state, 'Verified');
});

test('a requirement row reads as off, warning or blocking, and no row at all is off', () => {
  assert.equal(gatingModeOf(undefined), 'off');
  assert.equal(gatingModeOf(null), 'off');
  assert.equal(gatingModeOf(2), 'warning');
  assert.equal(gatingModeOf(1), 'blocking');
});
