import type { UserRole } from '@/lib/types';

export const PERSONNEL_PAGE_ROLES: UserRole[] = [
  'Admin',
  'Operator Admin',
  'Contractor Admin',
  'Manager',
  'Supervisor',
  'Consultant',
];

export function canEditUserRecord(canMutateUsers: boolean, _role: UserRole) {
  return canMutateUsers;
}

export function canLoadPersonnelData(role: UserRole) {
  return PERSONNEL_PAGE_ROLES.includes(role);
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
