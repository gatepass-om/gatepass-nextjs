import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./new-company-form.tsx', import.meta.url), 'utf8');

test('contractor registration includes company, contract, administrator and final review steps', () => {
  assert.match(source, /Company details/);
  assert.match(source, /Contract details/);
  assert.match(source, /Admin details/);
  assert.match(source, /Review & submit/);
  assert.match(source, /name="contractNumber"/);
  assert.match(source, /name="contractValidFrom"/);
  assert.match(source, /name="contractValidTo"/);
});
