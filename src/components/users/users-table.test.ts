import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./users-table.tsx', import.meta.url), 'utf8');

test('personnel use a compact spreadsheet-style table with operational columns', () => {
  for (const heading of ['Name', 'National ID', 'Email', 'Company', 'Nationality', 'Job position', 'Role', 'Status']) {
    assert.match(source, new RegExp(`>${heading}<`));
  }
  assert.match(source, /border-collapse/);
  assert.match(source, /user\.idNumber/);
  assert.match(source, /user\.nationality/);
  assert.match(source, /user\.employment\?\.jobPositionName/);
});
