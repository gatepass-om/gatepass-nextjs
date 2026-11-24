import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeTeam, teamMemberMatches } from './contractor-team';
import type { ContractorTeamMember } from './types';

const member = (overrides: Partial<ContractorTeamMember>): ContractorTeamMember => ({
  id: 'u', name: 'Ahmed', role: 'Worker', status: 'Active', onSite: false, assignments: [], ...overrides,
});

test('the team summary counts people on site, on a work pass and unassigned', () => {
  const summary = summarizeTeam([
    member({ onSite: true, assignments: [{ projectId: 'p', projectName: 'Pipeline', capacity: 'Work pass', workPassNumber: 'WP-1' }] }),
    member({ assignments: [{ projectId: 'p', projectName: 'Pipeline', capacity: 'Project supervisor' }] }),
    member({}),
  ]);
  assert.deepEqual(summary, { people: 3, onSite: 1, onWorkPass: 1, unassigned: 1 });
});

test('searching the team matches projects and sites as well as names', () => {
  const ahmed = member({ assignments: [{ projectId: 'p', projectName: 'Compressor Overhaul', capacity: 'Work pass', siteName: 'Marmul' }] });
  assert.ok(teamMemberMatches(ahmed, 'compressor'));
  assert.ok(teamMemberMatches(ahmed, 'MARMUL'));
  assert.ok(teamMemberMatches(ahmed, ''));
  assert.ok(!teamMemberMatches(ahmed, 'tank'));
});
