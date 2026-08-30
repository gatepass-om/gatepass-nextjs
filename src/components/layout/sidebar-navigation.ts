import type { UserRole } from '@/lib/types';

export type NavigationItem = {
  href: string;
  label: string;
  roles: UserRole[];
};

const navigationItems: NavigationItem[] = [
  { href: '/dashboard', label: 'Dashboard', roles: ['Admin', 'Operator Admin', 'Manager', 'Supervisor', 'Contractor Admin', 'Security'] },
  { href: '/access-requests', label: 'Site Access', roles: ['Admin', 'Operator Admin', 'Manager', 'Worker', 'Supervisor', 'Contractor Admin'] },
  { href: '/alerts', label: 'Alerts & Muster', roles: ['Admin', 'Operator Admin', 'Manager', 'Security'] },
  { href: '/inspections', label: 'Inspections', roles: ['Admin', 'Operator Admin', 'Manager', 'Supervisor', 'Security', 'Inspector'] },
  { href: '/location-governance', label: 'Geofencing', roles: ['Admin', 'Operator Admin', 'Manager', 'Supervisor'] },
  { href: '/projects', label: 'Projects', roles: ['Admin', 'Operator Admin', 'Manager', 'Supervisor', 'Contractor Admin'] },
  { href: '/compliance', label: 'Compliance Setup', roles: ['Admin', 'Operator Admin'] },
  { href: '/sites', label: 'Site Management', roles: ['Admin', 'Operator Admin'] },
  { href: '/companies', label: 'Companies', roles: ['Admin', 'Operator Admin', 'Supervisor'] },
  { href: '/users', label: 'Personnel', roles: ['Admin', 'Operator Admin', 'Contractor Admin', 'Manager', 'Supervisor'] },
  { href: '/certificates', label: 'Certificates', roles: ['Admin', 'Operator Admin'] },
  { href: '/profile', label: 'My Account', roles: ['Worker', 'Visitor', 'Manager', 'Supervisor', 'Admin', 'Operator Admin', 'Security', 'Contractor Admin'] },
  { href: '/notifications', label: 'Notifications', roles: ['Worker', 'Visitor', 'Manager', 'Supervisor', 'Admin', 'Operator Admin', 'Security', 'Contractor Admin', 'Inspector'] },
];

export function getNavigationForRole(role: UserRole, context: { externalCompany?: boolean } = {}) {
  return navigationItems.filter((item) =>
    item.roles.includes(role)
    && !(context.externalCompany && item.href === '/location-governance'));
}
