import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const projectsSource = readFileSync(
  new URL('../../app/(app)/projects/page.tsx', import.meta.url),
  'utf8',
);
const projectDetailSource = readFileSync(
  new URL('../../app/(app)/projects/[id]/page.tsx', import.meta.url),
  'utf8',
);

test('project rows expose only work-pass decisions assigned to the viewer', () => {
  assert.match(projectsSource, /getWorkPassActions/);
  assert.match(projectsSource, /actions\.includes\('approve'\) \|\| item\.actions\.includes\('second-approve'\)/);
  assert.match(projectsSource, /singleActionable\.actions\.includes\('second-approve'\)/);
  assert.match(projectsSource, /disabled=\{busyWorkPassId === singleActionable\.pass\.id\}/);
  assert.match(projectsSource, /<CheckCircle2[^>]*\/> Approve/);
  assert.match(projectsSource, />\s*Reject\s*</);
});

test('projects with multiple assigned decisions show a queue count instead of ambiguous buttons', () => {
  assert.match(projectsSource, /actionablePasses\.length > 1/);
  assert.match(projectsSource, /work passes need your decision/);
  assert.match(projectsSource, /actionablePasses\.length === 1/);
});

test('the project request queue stays bounded and scrollable', () => {
  assert.match(projectDetailSource, /h-\[340px\][^"']*overflow-y-auto/);
});
