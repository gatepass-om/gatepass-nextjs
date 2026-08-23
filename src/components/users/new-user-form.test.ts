import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./new-user-form.tsx', import.meta.url), 'utf8');

test('the create-user form requires national ID and email', () => {
  assert.match(source, /idNumber:\s*z\.string\(\)\.trim\(\)\.min\(/);
  assert.match(source, /email:\s*z\.string\(\)\.trim\(\)\.email\(/);
  assert.match(source, /<FormLabel>National ID number \*<\/FormLabel>/);
  assert.match(source, /<FormLabel>Email address \*<\/FormLabel>/);
  assert.match(source, /idNumber:\s*values\.idNumber/);
});

test('the create-user form does not ask how the person will use GatePass', () => {
  assert.doesNotMatch(source, /How will they use GatePass/);
  assert.doesNotMatch(source, /What help is useful/);
  assert.doesNotMatch(source, /interactiveAccountEnabled:\s*z\.boolean/);
  assert.doesNotMatch(source, /preferredInteractionMode:\s*z\.enum/);
});
