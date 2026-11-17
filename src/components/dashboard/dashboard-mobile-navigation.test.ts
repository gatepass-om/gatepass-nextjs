import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const dashboardPage = readFileSync(
  new URL('../../app/(app)/dashboard/page.tsx', import.meta.url),
  'utf8',
);

test('dashboard top bar exposes a mobile sidebar trigger', () => {
  assert.match(dashboardPage, /import\s*\{\s*SidebarTrigger\s*\}\s*from\s*['"]@\/components\/ui\/sidebar['"]/);
  assert.match(dashboardPage, /<SidebarTrigger[^>]*md:hidden/);
});
