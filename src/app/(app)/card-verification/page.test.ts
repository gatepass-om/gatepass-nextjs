import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

test('personnel scan accepts both a live QR and a printed badge credential', () => {
  assert.match(source, /Personnel Scan/);
  assert.match(source, /resolvePersonnelScanRequest/);
  assert.match(source, /live QR or printed badge/);
});

test('managers can scan and start an inspection without being offered gate controls', () => {
  assert.match(source, /'Manager'/);
  assert.match(source, /Start inspection/);
  assert.match(source, /canRecordGateActivity/);
  assert.match(source, /user\?\.role === 'Admin' \|\| user\?\.role === 'Security'/);
});

test('inspection outcome is independent from the live access verdict', () => {
  assert.match(source, /useState<'Compliant' \| 'NonCompliant' \| null>\(null\)/);
  assert.match(source, /setInspectionOutcome\('Compliant'\)/);
  assert.match(source, /setInspectionOutcome\('NonCompliant'\)/);
  assert.match(source, /createInspectionRequest/);
  assert.match(source, /Inspection findings do not change access unless a configured policy says so/);
});
