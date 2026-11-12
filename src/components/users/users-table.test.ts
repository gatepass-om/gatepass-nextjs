import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./users-table.tsx', import.meta.url), 'utf8');
const pageSource = readFileSync(new URL('../../app/(app)/users/page.tsx', import.meta.url), 'utf8');

test('personnel use a compact five-column table on laptops and cards on phones', () => {
  for (const heading of ['Name', 'Company', 'Role', 'Job position']) {
    assert.match(source, new RegExp(`>${heading}<`));
  }
  assert.doesNotMatch(source, /min-w-\[1240px\]/);
  assert.match(source, /hidden md:block/);
  assert.match(source, /md:hidden/);
  assert.match(source, /user\.employment\?\.jobPositionName/);
  assert.ok(source.indexOf('>Role<') < source.indexOf('>Job position<'));
});

test('adding a person is a visible page action that opens the add-person dialog', () => {
  assert.match(pageSource, /Add person/);
  assert.match(pageSource, /<AddPersonDialog/);
  assert.doesNotMatch(source, /InlineUserRow/);
});

test('personnel rows and edit actions navigate to a dedicated profile page', () => {
  assert.match(source, /useRouter\(\)/);
  assert.match(source, /router\.push\(`\/users\/\$\{user\.id\}`\)/);
  assert.match(source, /onClick=\{\(\) => openProfile\(user\)\}/);
  assert.match(source, /onSelect=\{\(\) => openProfile\(user\)\}/);
  assert.doesNotMatch(source, /<EditUserForm/);
  assert.doesNotMatch(source, /Edit User Profile/);
});

test('personnel actions provide a secure activation-link resend control', () => {
  assert.match(source, /onResendActivation/);
  assert.match(source, /Resend activation link/);
  assert.match(source, /user\.status === ["']Inactive["']/);
});

test('the personnel list reloads server state after create and delete', () => {
  const reloads = pageSource.match(/await fetchData\(\)/g) ?? [];
  assert.ok(reloads.length >= 3, 'create, delete, and activation resend should reload personnel');
});
