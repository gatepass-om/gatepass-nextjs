import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./api.ts', import.meta.url), 'utf8');

test('frontend exposes a unified scan resolver for live QR and printed badge credentials', () => {
  assert.match(source, /export async function resolvePersonnelScanRequest/);
  assert.match(source, /'\/scan\/resolve'/);
  assert.match(source, /token: input\.credential/);
  assert.match(source, /siteId: input\.siteId/);
});

test('frontend can record an inspection separately from a scan result', () => {
  assert.match(source, /export async function createInspectionRequest/);
  assert.match(source, /'\/inspections'/);
  assert.match(source, /workerId: string/);
  assert.match(source, /wrongfulConductReason\?: string/);
});
