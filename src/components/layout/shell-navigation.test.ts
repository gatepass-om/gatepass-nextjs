import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's built-in TypeScript runner requires the source extension.
import { getNavigationForRole } from './sidebar-navigation.ts';
// @ts-expect-error Node's built-in TypeScript runner requires the source extension.
import { ACCOUNT_ROUTES, DESKTOP_LINK_LIMIT, PHONE_TAB_LIMIT, isActiveRoute, splitForDesktop, splitForPhone, tabLabel } from './shell-navigation.ts';

const roles = ['Admin', 'Operator Admin', 'Manager', 'Supervisor', 'Security', 'Inspector', 'Contractor Admin', 'Worker', 'Visitor'] as const;
const hrefs = (items: { href: string }[]) => items.map((item) => item.href).sort();

test('the desktop bar and More drop nothing a role can reach, apart from pages the bell and user menu open', () => {
  for (const role of roles) {
    const all = getNavigationForRole(role);
    const { primary, more } = splitForDesktop(all);
    const shown = new Set([...primary, ...more].map((item) => item.href));
    for (const item of all) {
      assert.ok(shown.has(item.href) || ACCOUNT_ROUTES.includes(item.href), `${role} loses ${item.href} on desktop`);
    }
    assert.ok(primary.length <= DESKTOP_LINK_LIMIT + 1, `${role} has too many top-bar links`);
  }
});

test('the phone bar and More drop nothing a role can reach', () => {
  for (const role of roles) {
    const all = getNavigationForRole(role);
    const { tabs, more } = splitForPhone(all);
    assert.deepEqual(hrefs([...tabs, ...more]), hrefs(all), `${role} loses a page on phone`);
    assert.ok(tabs.length <= PHONE_TAB_LIMIT + 1, `${role} has too many tabs`);
    if (more.length) assert.equal(tabs.length, PHONE_TAB_LIMIT);
  }
});

test('an admin keeps the main work pages in the bar and folds the rest into More', () => {
  const { primary, more } = splitForDesktop(getNavigationForRole('Admin'));
  assert.deepEqual(primary.map((item: { href: string }) => item.href), ['/projects', '/users', '/companies', '/reports', '/card-verification']);
  assert.ok(more.some((item: { href: string }) => item.href === '/alerts'));
});

test('a security officer sees every work page without a More menu, with the scan first on a phone', () => {
  const all = getNavigationForRole('Security');
  assert.equal(splitForDesktop(all).more.length, 0);
  assert.equal(splitForPhone(all).tabs[0].href, '/card-verification');
});

test('roles with only account pages keep them as links', () => {
  for (const role of ['Worker', 'Visitor'] as const) {
    const { primary } = splitForDesktop(getNavigationForRole(role));
    assert.ok(primary.length > 0);
  }
});

test('active route matching is exact or by parent path, never by shared prefix', () => {
  assert.equal(isActiveRoute('/projects', '/projects'), true);
  assert.equal(isActiveRoute('/projects/123', '/projects'), true);
  assert.equal(isActiveRoute('/projects-archive', '/projects'), false);
  assert.equal(tabLabel({ href: '/card-verification', label: 'Personnel Scan' }), 'Scan');
  assert.equal(tabLabel({ href: '/reports', label: 'Reports' }), 'Reports');
});
