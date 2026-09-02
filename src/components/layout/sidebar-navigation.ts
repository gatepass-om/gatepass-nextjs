import type { UserRole } from '@/lib/types';

export type NavigationItem = {
  href: string;
  label: string;
  roles: UserRole[];
};

const navigationItems: NavigationItem[] = [
  { href: '/projects', label: 'Projects', roles: ['Admin', 'Operator Admin', 'Manager', 'Supervisor', 'Contractor Admin'] },
  { href: '/alerts', label: 'Alerts & Muster', roles: ['Admin', 'Operator Admin', 'Manager', 'Security'] },
  { href: '/card-verification', label: 'Personnel Scan', roles: ['Admin', 'Manager', 'Security', 'Supervisor', 'Inspector'] },
  { href: '/inspections', label: 'Inspections', roles: ['Admin', 'Operator Admin', 'Manager', 'Supervisor', 'Security', 'Inspector'] },
  { href: '/companies', label: 'Companies', roles: ['Admin', 'Operator Admin', 'Supervisor'] },
  { href: '/users', label: 'Personnel', roles: ['Admin', 'Operator Admin', 'Contractor Admin', 'Manager', 'Supervisor'] },
  { href: '/certificates', label: 'Certificates', roles: ['Admin', 'Operator Admin'] },
  { href: '/profile', label: 'My Account', roles: ['Worker', 'Visitor', 'Manager', 'Supervisor', 'Admin', 'Operator Admin', 'Security', 'Contractor Admin'] },
  { href: '/notifications', label: 'Notifications', roles: ['Worker', 'Visitor', 'Manager', 'Supervisor', 'Admin', 'Operator Admin', 'Security', 'Contractor Admin', 'Inspector'] },
];

export function getNavigationForRole(role: UserRole, context: { externalCompany?: boolean } = {}) {
  return navigationItems.filter((item) =>
    item.roles.includes(role));
}
