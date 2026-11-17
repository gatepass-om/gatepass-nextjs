import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const navigationSource = readFileSync(
  new URL('../layout/sidebar-navigation.ts', import.meta.url),
  'utf8',
);
const sidebarSource = readFileSync(
  new URL('../layout/sidebar-nav.tsx', import.meta.url),
  'utf8',
);

test('every configured sidebar route has an icon', () => {
  const configuredRoutes = [
    ...navigationSource.matchAll(/href:\s*['"]([^'"]+)['"]/g),
  ].map((match) => match[1]);
  const iconRoutes = new Set(
    [...sidebarSource.matchAll(/['"](\/[^'"]+)['"]:\s*[A-Z][A-Za-z0-9]*/g)]
      .map((match) => match[1]),
  );

  const missingIcons = configuredRoutes.filter((route) => !iconRoutes.has(route));

  assert.deepEqual(missingIcons, []);
});
