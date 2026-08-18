import type { UserRole } from '@/lib/types';

export const PERSONNEL_PAGE_ROLES: UserRole[] = [
  'Admin',
  'Operator Admin',
  'Contractor Admin',
  'Manager',
  'Supervisor',
];

export function canEditUserRecord(canMutateUsers: boolean, _role: UserRole) {
  return canMutateUsers;
}

export function canLoadPersonnelData(role: UserRole) {
  return PERSONNEL_PAGE_ROLES.includes(role);
}

/**
 * Contractor administrators manage their own workforce, but must not be sent
 * the operator-wide site directory. Requesting it makes the entire personnel
 * page fail with a 403 even though the user list itself is in scope.
 */
export function shouldLoadPersonnelSites(role: UserRole) {
  return role !== 'Contractor Admin';
}

/**
 * QR credentials identify every person who may need to be verified on site.
 * Their role is encoded in the printed card colour and live scan decision,
 * rather than being used to hide card issuance in the directory.
 */
export function canIssuePersonnelCard(role: UserRole) {
  return ['Admin', 'Operator Admin', 'Contractor Admin'].includes(role);
}

export function canImpersonateUser(
  currentUserRole: UserRole,
  currentUserId: string,
  targetUserId: string,
) {
  return ['Admin', 'Operator Admin', 'Contractor Admin'].includes(currentUserRole)
    && currentUserId !== targetUserId;
}

export function shouldShowWorkerDocuments(role: UserRole) {
  return role === 'Worker';
}
