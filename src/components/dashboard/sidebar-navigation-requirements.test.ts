import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
// @ts-expect-error Node's built-in TypeScript runner requires the source extension.
import { getNavigationForRole } from '../layout/sidebar-navigation.ts';

const sidebarSource = readFileSync(
  new URL('../layout/sidebar-nav.tsx', import.meta.url),
  'utf8',
);

test('client navigation exposes one emergency center and no card-production tools', () => {
  for (const role of ['Operator Admin', 'Manager', 'Security', 'Contractor Admin'] as const) {
    const items = getNavigationForRole(role);
    const routes = items.map((item) => item.href);

    assert.equal(routes.includes('/card-production'), false);
    assert.equal(routes.includes('/card-verification'), false);
    assert.equal(routes.includes('/muster'), false);
  }

  assert.equal(
    getNavigationForRole('Operator Admin').find((item) => item.href === '/alerts')?.label,
    'Alerts & Muster',
  );
});

test('inspection analytics replaces the website scan workstation', () => {
  for (const role of ['Admin', 'Operator Admin', 'Manager', 'Supervisor', 'Security', 'Inspector'] as const) {
    const routes = getNavigationForRole(role).map((item) => item.href);
    assert.equal(routes.includes('/inspections'), true);
    assert.equal(routes.includes('/scan'), false);
  }

  for (const role of ['Worker', 'Visitor'] as const) {
    assert.equal(
      getNavigationForRole(role).some((item) => item.href === '/inspections'),
      false,
    );
  }
});

test('the account destination uses the simplified account label', () => {
  for (const role of ['Admin', 'Operator Admin', 'Contractor Admin', 'Worker'] as const) {
    assert.equal(
      getNavigationForRole(role).find((item) => item.href === '/profile')?.label,
      'My Account',
    );
  }
});

test('external-company users do not see geofencing navigation', () => {
  assert.equal(
    getNavigationForRole('Contractor Admin', { externalCompany: true })
      .some((item) => item.href === '/location-governance'),
    false,
  );
  assert.equal(
    getNavigationForRole('Supervisor', { externalCompany: true })
      .some((item) => item.href === '/location-governance'),
    false,
  );
  assert.equal(
    getNavigationForRole('Supervisor', { externalCompany: false })
      .some((item) => item.href === '/location-governance'),
    true,
  );
});

test('deferred modules are hidden and the remaining links are not grouped', () => {
  const hiddenRoutes = ['/surveillance', '/permits', '/smart-access', '/decision-rules'];

  for (const role of [
    'Admin',
    'Operator Admin',
    'Manager',
    'Supervisor',
    'Security',
    'Inspector',
    'Contractor Admin',
    'Worker',
    'Visitor',
  ] as const) {
    const routes = getNavigationForRole(role).map((item) => item.href);
    for (const route of hiddenRoutes) assert.equal(routes.includes(route), false);
  }

  assert.doesNotMatch(sidebarSource, /SidebarGroupLabel/);
  assert.doesNotMatch(sidebarSource, /section\.group/);
});
