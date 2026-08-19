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

test('uses the Water Blue and Teal product palette', () => {
  assert.match(globalStyles, /--primary: 194 90% 32%;/);
  assert.match(globalStyles, /--accent: 176 76% 36%;/);
  assert.match(globalStyles, /--accent-foreground: 202 45% 15%;/);
  assert.match(globalStyles, /--sidebar-background: 194 88% 23%;/);
  assert.match(globalStyles, /--background: 200 38% 97%;/);
  assert.match(globalStyles, /--foreground: 202 45% 15%;/);
  assert.match(globalStyles, /--border: 197 29% 88%;/);
});

test('keeps the dashboard frame aligned with the shared palette', () => {
  assert.match(globalStyles, /background: #07566d;/i);
  assert.match(globalStyles, /background: #16a39a !important;/i);
  assert.doesNotMatch(globalStyles, /#287e69|#38b487|161 52%/i);
});

test('uses theme colors for dashboard brand surfaces while preserving semantic statuses', () => {
  assert.match(dashboardPage, /bg-\[#f4f8fa\]/i);
  assert.match(dashboardPage, /text-primary/);
  assert.match(dashboardPage, /data-\[state=active\]:bg-primary/);
  assert.match(dashboardTools, /hover:bg-primary\/5 hover:text-primary/);
  assert.match(dashboardVisuals, /teal: 'hsl\(176 76% 36%\)'/);
  assert.match(dashboardVisuals, /rounded-full bg-primary/);
  assert.match(operationsMap, /primary: '#087a9c'/i);
  assert.match(operationsMap, /teal: '#16a39a'/i);
});
