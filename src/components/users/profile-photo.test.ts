import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const profilePage = readFileSync(new URL('../../app/(app)/users/[id]/page.tsx', import.meta.url), 'utf8');
const apiSource = readFileSync(new URL('../../lib/api.ts', import.meta.url), 'utf8');

test('personnel profile provides a dedicated editable profile photo control', () => {
  assert.match(profilePage, /WorkerProfilePhoto/);
  assert.match(profilePage, /canEdit=\{canEdit && user\.role === 'Worker'\}/);
});

test('profile photos can be previewed securely from a worker document', () => {
  assert.match(apiSource, /export async function getWorkerDocumentPreviewUrl/);
  assert.match(apiSource, /\/documents\/\$\{documentId\}\/download/);
});
