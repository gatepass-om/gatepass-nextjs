import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
// @ts-expect-error Node's native TypeScript runner requires the explicit extension.
import { getNavigationForRole } from '../layout/sidebar-navigation.ts';

const designerSource = readFileSync(new URL('./workflow-designer.tsx', import.meta.url), 'utf8');
const pageSource = readFileSync(new URL('../../app/(app)/workflows/page.tsx', import.meta.url), 'utf8');
const layoutSource = readFileSync(new URL('../../app/(app)/workflows/layout.tsx', import.meta.url), 'utf8');
const navigationSource = readFileSync(new URL('../layout/sidebar-navigation.ts', import.meta.url), 'utf8');
const taskInboxSource = readFileSync(new URL('./workflow-task-inbox.tsx', import.meta.url), 'utf8');

test('workflow designer is disabled by default for the demo', () => {
  const previous = process.env.NEXT_PUBLIC_WORKFLOW_STUDIO_ENABLED;
  delete process.env.NEXT_PUBLIC_WORKFLOW_STUDIO_ENABLED;

  try {
    assert.equal(getNavigationForRole('Admin').some((item) => item.href === '/workflows'), false);
    assert.match(layoutSource, /if \(!isWorkflowStudioEnabled\(\)\) notFound\(\)/);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_WORKFLOW_STUDIO_ENABLED;
    else process.env.NEXT_PUBLIC_WORKFLOW_STUDIO_ENABLED = previous;
  }
});

test('workflow designer can be re-enabled for GatePass admins only', () => {
  const previous = process.env.NEXT_PUBLIC_WORKFLOW_STUDIO_ENABLED;
  process.env.NEXT_PUBLIC_WORKFLOW_STUDIO_ENABLED = 'true';

  try {
    assert.equal(getNavigationForRole('Admin').some((item) => item.href === '/workflows'), true);
    assert.equal(getNavigationForRole('Operator Admin').some((item) => item.href === '/workflows'), false);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_WORKFLOW_STUDIO_ENABLED;
    else process.env.NEXT_PUBLIC_WORKFLOW_STUDIO_ENABLED = previous;
  }
});

test('workflow designer remains restricted to GatePass admins when enabled', () => {
  assert.match(pageSource, /useAuthProtection\(\['Admin'\]\)/);
  assert.match(navigationSource, /href: '\/workflows'.*roles: \['Admin'\]/);
});

test('admin task inbox can approve and reject tenant workflow tasks', () => {
  assert.match(taskInboxSource, /listWorkflowTasksRequest/);
  assert.match(taskInboxSource, /completeWorkflowTaskRequest/);
  assert.match(taskInboxSource, /Approve<\/Button>/);
  assert.match(taskInboxSource, /Reject<\/Button>/);
});

test('workflow designer lazy-loads BPMN and supports validation and deployment', () => {
  assert.match(designerSource, /import\('bpmn-js\/lib\/Modeler'\)/);
  assert.match(designerSource, /validateBpmnRequest/);
  assert.match(designerSource, /deployBpmnRequest/);
  assert.match(designerSource, /Save BPMN/);
  assert.match(designerSource, /Deploy workflow/);
});
