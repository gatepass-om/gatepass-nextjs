import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const designerSource = readFileSync(new URL('./workflow-designer.tsx', import.meta.url), 'utf8');
const pageSource = readFileSync(new URL('../../app/(app)/workflows/page.tsx', import.meta.url), 'utf8');
const navigationSource = readFileSync(new URL('../layout/sidebar-navigation.ts', import.meta.url), 'utf8');
const taskInboxSource = readFileSync(new URL('./workflow-task-inbox.tsx', import.meta.url), 'utf8');

test('workflow designer is restricted to GatePass admins', () => {
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
