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

test('uses the Apple-style light and blue-accent product palette', () => {
  assert.match(globalStyles, /--primary: 211 100% 50%;/);
  assert.match(globalStyles, /--accent: 211 100% 95%;/);
  assert.match(globalStyles, /--accent-foreground: 211 100% 36%;/);
  assert.match(globalStyles, /--sidebar-background: 240 20% 96%;/);
  assert.match(globalStyles, /--background: 240 20% 97%;/);
  assert.match(globalStyles, /--foreground: 240 6% 12%;/);
  assert.match(globalStyles, /--border: 240 10% 88%;/);
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
