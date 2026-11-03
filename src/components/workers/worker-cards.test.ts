import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./worker-cards.tsx', import.meta.url), 'utf8');

test('expired worker cards expose an explicit renewal action', () => {
  assert.match(source, /const expiredCard = cards\.find/);
  assert.match(source, /Renew card/);
  assert.match(source, /handleRenew/);
  assert.match(source, /issueWorkerCard/);
});
