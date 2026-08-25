import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const projectPage = readFileSync(
  new URL('../../app/(app)/projects/[id]/page.tsx', import.meta.url),
  'utf8',
);
const usersPage = readFileSync(
  new URL('../../app/(app)/users/page.tsx', import.meta.url),
  'utf8',
);

test('worker access captures a validity period and links to worker registration', () => {
  assert.match(projectPage, />Valid from</);
  assert.match(projectPage, />Valid to</);
  assert.match(projectPage, /Register worker/);
  assert.match(projectPage, /\/users\?new=worker/);
});

test('worker registration can return to the requesting project', () => {
  assert.match(usersPage, /searchParams\.get\(['"]new['"]\)/);
  assert.match(usersPage, /searchParams\.get\(['"]returnTo['"]\)/);
});
