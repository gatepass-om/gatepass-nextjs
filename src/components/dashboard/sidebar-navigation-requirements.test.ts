import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's built-in TypeScript runner requires the source extension.
import { getNavigationForRole } from '../layout/sidebar-navigation.ts';

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

test('the account destination uses the simplified account label', () => {
  for (const role of ['Admin', 'Operator Admin', 'Contractor Admin', 'Worker'] as const) {
    assert.equal(
      getNavigationForRole(role).find((item) => item.href === '/profile')?.label,
      'My Account',
    );
  }
});
