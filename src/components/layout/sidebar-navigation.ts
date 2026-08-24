import type { UserRole } from '@/lib/types';

export type NavigationItem = {
  href: string;
  label: string;
  group: string;
  roles: UserRole[];
};

const navigationItems: NavigationItem[] = [
  { href: '/dashboard', label: 'Dashboard', group: 'Operations', roles: ['Admin', 'Operator Admin', 'Manager', 'Supervisor', 'Contractor Admin', 'Security'] },
  { href: '/access-requests', label: 'Access Requests', group: 'Operations', roles: ['Admin', 'Operator Admin', 'Manager', 'Worker', 'Supervisor', 'Contractor Admin'] },
  { href: '/alerts', label: 'Alerts', group: 'Operations', roles: ['Admin', 'Operator Admin', 'Manager', 'Security'] },
  { href: '/muster', label: 'Muster', group: 'Operations', roles: ['Admin', 'Operator Admin', 'Manager', 'Security'] },
  { href: '/scan', label: 'Scan Workstation', group: 'Operations', roles: ['Security', 'Inspector'] },
  { href: '/card-verification', label: 'Card Verification', group: 'Operations', roles: ['Admin', 'Operator Admin', 'Manager', 'Security', 'Contractor Admin'] },
  { href: '/card-production', label: 'Card Production', group: 'Operations', roles: ['Admin', 'Operator Admin', 'Contractor Admin'] },
  { href: '/location-governance', label: 'Geofencing', group: 'Governance', roles: ['Admin', 'Operator Admin', 'Manager', 'Contractor Admin', 'Supervisor'] },
  { href: '/projects', label: 'Projects', group: 'Governance', roles: ['Admin', 'Operator Admin', 'Manager', 'Supervisor', 'Contractor Admin'] },
  { href: '/decision-rules', label: 'Decision Rules', group: 'Governance', roles: ['Admin'] },
  { href: '/compliance', label: 'Compliance Setup', group: 'Governance', roles: ['Admin', 'Operator Admin'] },
  { href: '/surveillance', label: 'Surveillance', group: 'Governance', roles: ['Admin', 'Operator Admin', 'Manager'] },
  { href: '/permits', label: 'Permits to Work', group: 'Governance', roles: ['Admin', 'Operator Admin', 'Manager', 'Supervisor', 'Worker'] },
  { href: '/smart-access', label: 'Smart Access', group: 'Infrastructure', roles: ['Admin', 'Operator Admin', 'Manager'] },
  { href: '/sites', label: 'Site Management', group: 'Infrastructure', roles: ['Admin', 'Operator Admin'] },
  { href: '/companies', label: 'Companies', group: 'Directory', roles: ['Admin', 'Operator Admin', 'Supervisor'] },
  { href: '/users', label: 'Personnel', group: 'Directory', roles: ['Admin', 'Operator Admin', 'Contractor Admin', 'Manager', 'Supervisor'] },
  { href: '/certificates', label: 'Certificates', group: 'Directory', roles: ['Admin', 'Operator Admin'] },
  { href: '/profile', label: 'My QR Code', group: 'Account', roles: ['Worker', 'Visitor', 'Manager', 'Supervisor', 'Admin', 'Operator Admin', 'Security', 'Contractor Admin'] },
  { href: '/notifications', label: 'Notifications', group: 'Account', roles: ['Worker', 'Visitor', 'Manager', 'Supervisor', 'Admin', 'Operator Admin', 'Security', 'Contractor Admin', 'Inspector'] },
];

export function getNavigationForRole(role: UserRole) {
  return navigationItems.filter((item) => item.roles.includes(role));
}
