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

test('inline personnel row creates welcome-email accounts through activation instead of Active status', () => {
  assert.match(source, /sendWelcomeEmail: true/);
  assert.match(source, /interactiveAccountEnabled: true/);
  assert.doesNotMatch(source, /status: 'Active',/);
});

test('site assignment is conditional inside the role cell rather than a separate table column', () => {
  assert.match(source, /aria-label="Assigned site"/);
  assert.doesNotMatch(source, /<TableCell className="border-r p-1\.5">\s*\{\['Security', 'Inspector'\]/);
});

test('inline controls use the same eight table columns as the personnel header', () => {
  assert.equal(source.match(/<TableCell/g)?.length, 9);
  const controls = [
    'aria-label="Full legal name"',
    'aria-label="National ID number"',
    'aria-label="Email address"',
    'aria-label="Company"',
    'aria-label="Nationality"',
    'aria-label="Job position"',
    'aria-label="Type of person"',
    'aria-label="Save personnel row"',
  ];
  const positions = controls.map((control) => source.indexOf(control));
  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual(positions, [...positions].sort((left, right) => left - right));
});
