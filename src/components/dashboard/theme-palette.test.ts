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

test('uses the black, white and grey product palette', () => {
  assert.match(globalStyles, /--primary: 0 0% 9%;/);
  assert.match(globalStyles, /--accent: 0 0% 92%;/);
  assert.match(globalStyles, /--accent-foreground: 0 0% 9%;/);
  assert.match(globalStyles, /--sidebar-background: 0 0% 8%;/);
  assert.match(globalStyles, /--background: 0 0% 97%;/);
  assert.match(globalStyles, /--foreground: 0 0% 9%;/);
  assert.match(globalStyles, /--border: 0 0% 86%;/);
});

test('keeps the dashboard frame aligned with the shared palette', () => {
  assert.match(globalStyles, /background: #141414;/i);
  assert.match(globalStyles, /background: #ffffff !important;/i);
  assert.match(
    globalStyles,
    /\[data-sidebar="header"\] \.bg-primary \.text-primary-foreground\s*\{[^}]*color: #141414 !important;/i,
  );
  assert.doesNotMatch(globalStyles, /#087a9c|#07566d|#16a39a|194 90%|176 76%/i);
});

test('uses theme colors for dashboard brand surfaces while preserving semantic statuses', () => {
  assert.match(dashboardPage, /bg-\[#f6f6f6\]/i);
  assert.match(dashboardPage, /text-primary/);
  assert.match(dashboardPage, /data-\[state=active\]:bg-primary/);
  assert.match(dashboardTools, /hover:bg-primary\/5 hover:text-primary/);
  assert.match(dashboardVisuals, /teal: 'hsl\(0 0% 32%\)'/);
  assert.match(dashboardVisuals, /teal: \{ icon: 'bg-accent\/40 text-primary', bar: 'bg-primary' \}/);
  assert.match(dashboardVisuals, /rounded-full bg-primary/);
  assert.match(operationsMap, /primary: '#171717'/i);
  assert.match(operationsMap, /teal: '#525252'/i);
});
