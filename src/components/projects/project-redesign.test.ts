import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
// @ts-expect-error Node's built-in TypeScript runner requires the source extension.
import { getNavigationForRole } from '../layout/sidebar-navigation.ts';
// @ts-expect-error Node's built-in TypeScript runner requires the source extension.
import { workspaceLandingForRole } from '../../lib/role-workspaces.ts';

const projectPage = readFileSync(new URL('../../app/(app)/projects/page.tsx', import.meta.url), 'utf8');
const projectDetail = readFileSync(new URL('../../app/(app)/projects/[id]/page.tsx', import.meta.url), 'utf8');
const wizard = readFileSync(new URL('./project-wizard-dialog.tsx', import.meta.url), 'utf8');

const requestPageUrl = new URL('../../app/(app)/projects/[id]/access-requests/[workPassId]/page.tsx', import.meta.url);
const personnelPageUrl = new URL('../../app/(app)/projects/[id]/personnel/page.tsx', import.meta.url);

test('projects are the primary workspace and deferred modules stay out of navigation', () => {
  for (const role of ['Admin', 'Operator Admin', 'Manager', 'Supervisor', 'Contractor Admin'] as const) {
    assert.equal(workspaceLandingForRole(role), '/projects');
    assert.equal(getNavigationForRole(role)[0]?.href, '/projects');
  }

  const hidden = ['/dashboard', '/access-requests', '/location-governance', '/compliance', '/sites'];
  for (const role of ['Admin', 'Operator Admin', 'Manager', 'Supervisor', 'Contractor Admin', 'Security'] as const) {
    const routes = getNavigationForRole(role).map((item) => item.href);
    for (const route of hidden) assert.equal(routes.includes(route), false);
  }
});

test('project create and edit use a four-step wizard with back and next navigation', () => {
  assert.match(wizard, /ProjectWizardStep/);
  assert.match(wizard, /useState<ProjectWizardStep>/);
  for (const step of ['details', 'sites', 'participants', 'review']) {
    assert.match(wizard, new RegExp(`['"]${step}['"]`));
  }
  assert.match(wizard, />Back</);
  assert.match(wizard, />Next</);
  assert.match(wizard, /step === ['"]details['"]/);
  assert.match(wizard, /step === ['"]review['"]/);
  assert.match(wizard, /Assigned supervisor/);
  assert.match(wizard, /supervisorUserId/);
});

test('project portfolio keeps only selective operational statistics', () => {
  for (const label of ['Active projects', 'Pending access decisions', 'Active work passes']) {
    assert.match(projectPage, new RegExp(label));
  }
  for (const removed of ['Project coverage', 'Ending in 30 days']) {
    assert.doesNotMatch(projectPage, new RegExp(removed));
  }
});

test('worker access requests open a project-scoped page with provenance and worker dialogs', () => {
  assert.equal(existsSync(requestPageUrl), true);
  if (!existsSync(requestPageUrl)) return;

  const requestPage = readFileSync(requestPageUrl, 'utf8');
  for (const label of ['Submitting contractor', 'Submitted by', 'Consulted by', 'Workers']) {
    assert.match(requestPage, new RegExp(label));
  }
  assert.match(requestPage, /Dialog/);
  assert.doesNotMatch(requestPage, /router\.push\(`\/users\//);
  assert.match(projectDetail, /access-requests\/\$\{pass\.id\}/);
  assert.doesNotMatch(projectDetail, /WorkPassDetailsSheet/);
});

test('project personnel has a filterable project-scoped table', () => {
  assert.equal(existsSync(personnelPageUrl), true);
  if (!existsSync(personnelPageUrl)) return;

  const personnelPage = readFileSync(personnelPageUrl, 'utf8');
  assert.match(projectDetail, /projects\/\$\{project\.id\}\/personnel/);
  assert.match(personnelPage, /Company/);
  assert.match(personnelPage, /Job position/);
  assert.match(personnelPage, /Compliance/);
  assert.match(personnelPage, /Search personnel/);
});
