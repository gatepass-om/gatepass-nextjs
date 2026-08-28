import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./inline-user-row.tsx', import.meta.url), 'utf8');

test('inline personnel row exposes every required account field', () => {
  for (const label of ['Full legal name', 'National ID number', 'Email address', 'Nationality', 'Type of person']) {
    assert.match(source, new RegExp(`aria-label="${label}"`));
  }
  assert.match(source, /NATIONALITY_OPTIONS\.map/);
  assert.match(source, /jobPositionId/);
});

test('inline personnel row validates required values before creating a person', () => {
  assert.match(source, /validateInlineUserDraft/);
  assert.match(source, /Enter the person’s full name/);
  assert.match(source, /Enter the National ID number/);
  assert.match(source, /Enter a valid email address/);
  assert.match(source, /Select a nationality/);
});

test('inline personnel row has explicit save and cancel actions', () => {
  assert.match(source, /aria-label="Save personnel row"/);
  assert.match(source, /aria-label="Cancel personnel row"/);
  assert.match(source, /Saving…/);
});
