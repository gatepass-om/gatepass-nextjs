import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./users-table.tsx', import.meta.url), 'utf8');

test('personnel use a compact spreadsheet-style table with operational columns', () => {
  for (const heading of ['Name', 'National ID', 'Email', 'Company', 'Nationality', 'Job position', 'Role']) {
    assert.match(source, new RegExp(`>${heading}<`));
  }
  assert.doesNotMatch(source, />Assigned site</);
  assert.match(source, /border-collapse/);
  assert.match(source, /user\.idNumber/);
  assert.match(source, /user\.nationality/);
  assert.match(source, /user\.employment\?\.jobPositionName/);
});

test('personnel can be created from an inline table row without opening a dialog', () => {
  assert.match(source, /aria-label="Add personnel row"/);
  assert.match(source, /<InlineUserRow/);
  assert.match(source, /onCreateUser=/);
  assert.doesNotMatch(source, /> Add row</);
});

test('the add control is integrated into the table and the register adapts to narrow screens', () => {
  assert.match(source, /<TableHead[^>]*aria-label="Row actions"/);
  assert.match(source, /overflow-x-auto/);
  assert.match(source, /min-w-\[1240px\]/);
  assert.match(source, /<colgroup>/);
  assert.equal(source.match(/<col className=/g)?.length, 8);
});

test('personnel rows and edit actions navigate to a dedicated profile page', () => {
  assert.match(source, /useRouter\(\)/);
  assert.match(source, /router\.push\(`\/users\/\$\{user\.id\}`\)/);
  assert.match(source, /onClick=\{\(\) => handleProfileClick\(user\)\}/);
  assert.match(source, /onSelect=\{\(\) => handleProfileClick\(user\)\}/);
  assert.doesNotMatch(source, /<EditUserForm/);
  assert.doesNotMatch(source, /Edit User Profile/);
});

test('personnel actions provide a secure activation-link resend control', () => {
  assert.match(source, /onResendActivation/);
  assert.match(source, /Resend activation link/);
});
