import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./new-company-form.tsx', import.meta.url), 'utf8');

test('contractor registration includes company, administrator and final review steps', () => {
  assert.match(source, /Company details/);
  assert.match(source, /Admin details/);
  assert.match(source, /Review & submit/);
});

test('contractor registration does not ask for contract details', () => {
  assert.doesNotMatch(source, /Contract details/);
  assert.doesNotMatch(source, /contractNumber/);
  assert.doesNotMatch(source, /contractValidFrom/);
  assert.doesNotMatch(source, /contractValidTo/);
});
