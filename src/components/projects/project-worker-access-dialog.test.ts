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

test('worker access dates are whole UTC days, like the project window they must fit in', () => {
  const page = readFileSync(new URL('../../app/(app)/projects/[id]/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /validFromUtc: `\$\{from\}T00:00:00\.000Z`/);
  assert.match(page, /validToUtc: `\$\{to\}T23:59:59\.000Z`/);
  assert.match(page, /timeZone: 'UTC'/);
});
