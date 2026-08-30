import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
  new URL('../../app/(app)/location-governance/page.tsx', import.meta.url),
  'utf8',
);

test('external-company principals cannot load or render geofencing governance', () => {
  assert.match(source, /const isExternalCompany = Boolean\(currentUser\?\.contractorId\)/);
  assert.match(source, /if \(!token \|\| !currentUser \|\| isExternalCompany\) return/);
  assert.match(source, /if \(isExternalCompany\) return <UnauthorizedComponent \/>/);
});
