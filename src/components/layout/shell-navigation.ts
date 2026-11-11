import type { NavigationItem } from './sidebar-navigation';

/**
 * Which of a role's navigation items the shell shows directly and which it folds into "More".
 * `getNavigationForRole` still decides what a role may reach; this only decides how it is laid out, and
 * nothing is ever dropped: every item lands in the bar, in "More", or (account pages) in the top-bar menus.
 */
export const DESKTOP_LINK_LIMIT = 5;
export const PHONE_TAB_LIMIT = 4;

/** Reachable from the notifications bell and the user menu, so the top-bar links skip them. */
export const ACCOUNT_ROUTES = ['/profile', '/notifications'];

const desktopOrder = [
  '/dashboard', '/projects', '/users', '/companies', '/reports', '/card-verification', '/alerts', '/inspections',
  '/contractor-user-applications', '/certificates', '/workflows',
];
const phoneOrder = [
  '/dashboard', '/card-verification', '/projects', '/users', '/reports', '/alerts', '/inspections', '/companies',
  '/contractor-user-applications', '/certificates', '/workflows', '/notifications', '/profile',
];

function byPriority<T extends { href: string }>(items: T[], order: string[]): T[] {
  const rank = (href: string) => {
    const index = order.indexOf(href);
    return index === -1 ? order.length : index;
  };
  return items
    .map((item, position) => ({ item, position }))
    .sort((a, b) => rank(a.item.href) - rank(b.item.href) || a.position - b.position)
    .map(({ item }) => item);
}

export function splitForDesktop<T extends { href: string }>(items: T[]): { primary: T[]; more: T[] } {
  const working = items.filter((item) => !ACCOUNT_ROUTES.includes(item.href));
  // A role with only account pages (Worker, Visitor) keeps them as links.
  const pool = byPriority(working.length > 0 ? working : items, desktopOrder);
  if (pool.length <= DESKTOP_LINK_LIMIT + 1) return { primary: pool, more: [] };
  return { primary: pool.slice(0, DESKTOP_LINK_LIMIT), more: pool.slice(DESKTOP_LINK_LIMIT) };
}

export function splitForPhone<T extends { href: string }>(items: T[]): { tabs: T[]; more: T[] } {
  const pool = byPriority(items, phoneOrder);
  if (pool.length <= PHONE_TAB_LIMIT + 1) return { tabs: pool, more: [] };
  return { tabs: pool.slice(0, PHONE_TAB_LIMIT), more: pool.slice(PHONE_TAB_LIMIT) };
}

export function isActiveRoute(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export type NavigationLabelled = Pick<NavigationItem, 'href' | 'label'>;

export const arabicLabels: Record<string, string> = {
  Projects: 'المشاريع',
  'Alerts & Muster': 'التنبيهات والتجمع',
  'Personnel Scan': 'مسح الأفراد',
  Inspections: 'التفتيش',
  Companies: 'الشركات',
  Personnel: 'الأفراد',
  Reports: 'التقارير',
  'User Approvals': 'اعتمادات المستخدمين',
  Certificates: 'الشهادات',
  'My Account': 'حسابي',
  Notifications: 'الإشعارات',
  'Workflow Studio': 'استوديو سير العمل',
  Scan: 'مسح',
  Alerts: 'التنبيهات',
  Approvals: 'الاعتمادات',
  Account: 'حسابي',
  More: 'المزيد',
};

/** Short names for the phone tab bar, where 11px labels have about 70px each. */
const tabLabels: Record<string, string> = {
  '/card-verification': 'Scan',
  '/alerts': 'Alerts',
  '/contractor-user-applications': 'Approvals',
  '/profile': 'Account',
};

export function tabLabel(item: NavigationLabelled): string {
  return tabLabels[item.href] ?? item.label;
}
