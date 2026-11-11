import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const globalStyles = readFileSync(
  new URL('../../app/globals.css', import.meta.url),
  'utf8',
);
const dashboardPage = readFileSync(
  new URL('../../app/(app)/dashboard/page.tsx', import.meta.url),
  'utf8',
);
const dashboardTools = readFileSync(new URL('./dashboard-tools.tsx', import.meta.url), 'utf8');
const dashboardVisuals = readFileSync(new URL('./dashboard-visuals.tsx', import.meta.url), 'utf8');
const operationsMap = readFileSync(new URL('../maps/ops-map.inner.tsx', import.meta.url), 'utf8');

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

test('keeps the dashboard frame aligned with the shared palette', () => {
  assert.match(globalStyles, /\.dashboard-reference-frame\s*\{[^}]*background: hsl\(var\(--sidebar-background\)\);/);
  assert.doesNotMatch(globalStyles, /#087a9c|#07566d|#16a39a|194 90%|176 76%/i);
});

test('uses theme colors for dashboard brand surfaces while preserving semantic statuses', () => {
  assert.match(dashboardPage, /bg-\[#f6f6f6\]/i);
  assert.match(dashboardPage, /text-primary/);
  assert.match(dashboardTools, /hover:bg-primary\/5 hover:text-primary/);
  assert.match(dashboardVisuals, /teal: 'hsl\(0 0% 32%\)'/);
  assert.match(dashboardVisuals, /teal: \{ icon: 'bg-accent\/40 text-primary', bar: 'bg-primary' \}/);
  assert.match(dashboardVisuals, /rounded-full bg-primary/);
  assert.match(operationsMap, /primary: '#171717'/i);
  assert.match(operationsMap, /teal: '#525252'/i);
});
