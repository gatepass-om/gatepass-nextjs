import type { UserRole } from '@/lib/types';

/**
 * The sole role-to-workspace map. Login, activation recovery, impersonation and authorization fallbacks use this
 * rather than each carrying a partial switch statement that strands lower-technical operational roles.
 */
export const workspaceLandingByRole: Record<UserRole, string> = {
  Admin: '/dashboard',
  'Operator Admin': '/dashboard',
  Manager: '/dashboard',
  Security: '/scan',
  'Contractor Admin': '/access-requests',
  Supervisor: '/access-requests',
  Worker: '/permits',
  Visitor: '/profile',
  Consultant: '/projects',
  Inspector: '/scan',
};

export function workspaceLandingForRole(role?: UserRole): string {
  return role ? workspaceLandingByRole[role] : '/login';
}
