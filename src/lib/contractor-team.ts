import type { ContractorTeamMember } from './types';

/** Counts for the team page header. A live work pass is one that is not finished, cancelled or rejected. */
export function summarizeTeam(members: ContractorTeamMember[]) {
  return {
    people: members.length,
    onSite: members.filter((member) => member.onSite).length,
    onWorkPass: members.filter((member) => member.assignments.some((assignment) => Boolean(assignment.workPassNumber))).length,
    unassigned: members.filter((member) => member.assignments.length === 0).length,
  };
}

/** Matches a search against a person's name, role, job title, current site, and assigned projects and sites. */
export function teamMemberMatches(member: ContractorTeamMember, search: string) {
  const term = search.trim().toLowerCase();
  if (!term) return true;
  return [
    member.name, member.role, member.jobTitle, member.email, member.currentSiteName,
    ...member.assignments.flatMap((assignment) => [assignment.projectName, assignment.siteName, assignment.workPassNumber]),
  ].some((value) => value?.toLowerCase().includes(term));
}
