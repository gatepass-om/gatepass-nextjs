import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const companiesPage = readFileSync(
  new URL('../../app/(app)/companies/page.tsx', import.meta.url),
  'utf8',
);

test('keeps existing company rows visible during polling refreshes', () => {
  assert.match(companiesPage, /const fetchData = useCallback\(async \(options\?: \{ silent\?: boolean \}\) =>/);
  assert.match(companiesPage, /if \(!options\?\.silent\) setLoadingData\(true\);/);
  assert.match(companiesPage, /if \(!options\?\.silent\) setLoadingData\(false\);/);
  assert.match(companiesPage, /void fetchData\(\{ silent: true \}\);/);
});
