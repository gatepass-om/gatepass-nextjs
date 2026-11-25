import type { UserRole, UserStatus } from '@/lib/types';

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

type PersonRef = { role: UserRole; contractorId?: string | null };

/**
 * Who may edit a person's file. Mirrors the API: supervisors look after their
 * own company's workers and visitors, a focal point (Manager) looks after a
 * company's supervisors and the operator's own staff, and operator admins
 * manage the operator's people and contractor supervisors (supervisors
 * register their own workers).
 */
export function canEditPersonRecord(viewer: PersonRef, subject: PersonRef) {
  const subjectCompany = subject.contractorId || null;
  switch (viewer.role) {
    case 'Admin':
      return true;
    case 'Operator Admin':
      return !subjectCompany || subject.role === 'Supervisor';
    case 'Contractor Admin':
      return !!viewer.contractorId && subjectCompany === viewer.contractorId;
    case 'Supervisor':
      return !!viewer.contractorId
        && subjectCompany === viewer.contractorId
        && ['Worker', 'Visitor'].includes(subject.role);
    case 'Manager':
      return subjectCompany
        ? subject.role === 'Supervisor'
        : ['Security', 'Inspector', 'Worker', 'Visitor'].includes(subject.role);
    default:
      return false;
  }
}

/** Roles a viewer may give the person they are editing. */
export function editableRolesFor(viewer: PersonRef, subject: PersonRef): UserRole[] {
  switch (viewer.role) {
    case 'Admin':
      return ['Admin', 'Operator Admin', 'Contractor Admin', 'Manager', 'Security', 'Visitor', 'Worker', 'Supervisor', 'Inspector'];
    case 'Operator Admin':
      return subject.contractorId ? ['Supervisor'] : ['Manager', 'Security', 'Worker', 'Inspector'];
    case 'Contractor Admin':
      return ['Supervisor', 'Worker', 'Visitor'];
    case 'Supervisor':
      return ['Worker', 'Visitor'];
    case 'Manager':
      return subject.contractorId ? ['Supervisor'] : ['Security', 'Inspector', 'Worker', 'Visitor'];
    case 'Security':
      return ['Visitor'];
    default:
      return [];
  }
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

export function canReviewWorkerCompliance(viewerRole: UserRole, subjectRole: UserRole) {
  return subjectRole === 'Worker' && ['Admin', 'Operator Admin', 'Manager'].includes(viewerRole);
}

export function canManageWorkerCard(viewerRole: UserRole, subjectStatus?: UserStatus) {
  return subjectStatus === 'Active' && canIssuePersonnelCard(viewerRole);
}
