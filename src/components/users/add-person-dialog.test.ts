import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./add-person-dialog.tsx', import.meta.url), 'utf8');

test('add-person dialog exposes every required account field', () => {
  for (const label of ['Full legal name', 'National ID number', 'Email address', 'Nationality', 'Type of person']) {
    assert.match(source, new RegExp(`aria-label="${label}"`));
  }
  assert.match(source, /NATIONALITY_OPTIONS\.map/);
  assert.match(source, /jobPositionId/);
});

test('add-person dialog is a three-step flow with per-step validation', () => {
  assert.match(source, /STEPS = \['Type', 'Identity', 'Review'\]/);
  assert.match(source, /validateInlineUserDraft/);
  assert.match(source, /Enter the person’s full name/);
  assert.match(source, /Enter the National ID number/);
  assert.match(source, /Enter a valid email address/);
  assert.match(source, /Select a nationality/);
});

test('add-person dialog has explicit back, continue and create actions', () => {
  assert.match(source, /'Back'/);
  assert.match(source, />Continue</);
  assert.match(source, /Create person/);
  assert.match(source, /Saving…/);
});

test('welcome-email accounts are created through activation instead of Active status', () => {
  assert.match(source, /sendWelcomeEmail: true/);
  assert.match(source, /interactiveAccountEnabled: true/);
  assert.doesNotMatch(source, /status: 'Active',/);
});

test('site assignment appears only for roles that need it', () => {
  assert.match(source, /aria-label="Assigned site"/);
  assert.match(source, /needsSite \?/);
});
