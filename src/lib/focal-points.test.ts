import { test } from 'node:test';
import assert from 'node:assert/strict';
import { focalCompanyNames, focalPointLossWarning } from './focal-points';

test('focalCompanyNames lists only the companies the person is focal point for, sorted', () => {
  const companies = [
    { name: 'Zeta Works', focalPointUserId: 'm1' },
    { name: 'Alpha Build', focalPointUserId: 'm1' },
    { name: 'Other Co', focalPointUserId: 'm2' },
    { name: 'Unassigned', focalPointUserId: null },
  ];
  assert.deepEqual(focalCompanyNames('m1', companies), ['Alpha Build', 'Zeta Works']);
  assert.deepEqual(focalCompanyNames(undefined, companies), []);
});

test('focalPointLossWarning is only shown for focal points', () => {
  assert.equal(focalPointLossWarning([]), null);
  assert.match(focalPointLossWarning(['Alpha Build']) ?? '', /focal point for Alpha Build/);
});
