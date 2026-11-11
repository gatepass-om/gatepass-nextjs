import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const globalStyles = readFileSync(
  new URL('../../app/globals.css', import.meta.url),
  'utf8',
);

test('uses the Sheets palette: soft grey page, white panels, one blue', () => {
  assert.match(globalStyles, /--primary: 218 74% 47%;/);
  assert.match(globalStyles, /--accent: 217 84% 95%;/);
  assert.match(globalStyles, /--accent-foreground: 218 74% 47%;/);
  assert.match(globalStyles, /--background: 220 20% 97%;/);
  assert.match(globalStyles, /--foreground: 220 6% 10%;/);
  assert.match(globalStyles, /--card: 0 0% 100%;/);
  assert.match(globalStyles, /--border: 225 9% 91%;/);
  assert.match(globalStyles, /--radius: 0\.5rem;/);
});

test('status colours come as a solid, a soft wash and an ink', () => {
  for (const status of ['success', 'danger', 'warning']) {
    assert.match(globalStyles, new RegExp(`--${status}-soft:`));
    assert.match(globalStyles, new RegExp(`--${status}-ink:`));
  }
  assert.match(globalStyles, /--pending-soft:/);
});
