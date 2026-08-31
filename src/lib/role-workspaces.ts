import type { UserRole } from '@/lib/types';

/**
 * The sole role-to-workspace map. Login, activation recovery, impersonation and authorization fallbacks use this
 * rather than each carrying a partial switch statement that strands lower-technical operational roles.
 */
export const workspaceLandingByRole: Record<UserRole, string> = {
  Admin: '/projects',
  'Operator Admin': '/projects',
  Manager: '/projects',
  Security: '/inspections',
  'Contractor Admin': '/projects',
  Supervisor: '/projects',
  Worker: '/permits',
  Visitor: '/profile',
  Inspector: '/inspections',
};

export function workspaceLandingForRole(role?: UserRole): string {
  return role ? workspaceLandingByRole[role] : '/login';
}
