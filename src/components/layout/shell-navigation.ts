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

/**
 * The desktop bar, grouped by what someone is trying to do rather than by a priority list with the
 * leftovers in "More". An admin reaching eleven pages through five links and one overflow menu had no
 * way to tell which of the hidden pages was which; four named menus say it on the trigger.
 *
 * Groups keep only the items the role can actually reach, a group left with a single item renders as a
 * plain link rather than a menu of one, and anything not named here still appears under "More" — the
 * invariant is that no page a role can reach ever disappears from the bar.
 */
export const NAVIGATION_GROUPS: Array<{ label: string; hrefs: string[] }> = [
  { label: 'Work', hrefs: ['/projects', '/contractor-user-applications'] },
  { label: 'People', hrefs: ['/users', '/companies'] },
  { label: 'Site', hrefs: ['/card-verification', '/inspections', '/alerts'] },
  { label: 'Admin', hrefs: ['/certificates', '/reports', '/workflows'] },
];

/** Shown on its own at the far left, never inside a menu. */
const STANDALONE_HREFS = ['/dashboard'];

export type NavigationGroup<T extends { href: string }> = {
  /** Stable key, also the menu trigger's text. */
  label: string;
  items: T[];
};

export function buildNavigationGroups<T extends { href: string }>(items: T[]): NavigationGroup<T>[] {
  const working = items.filter((item) => !ACCOUNT_ROUTES.includes(item.href));
  // A role with only account pages (Worker, Visitor) keeps them as links rather than an empty bar.
  const pool = working.length > 0 ? working : items;
  const byHref = new Map(pool.map((item) => [item.href, item]));
  const groups: NavigationGroup<T>[] = [];
  const placed = new Set<string>();

  for (const href of STANDALONE_HREFS) {
    const item = byHref.get(href);
    if (!item) continue;
    groups.push({ label: item.href, items: [item] });
    placed.add(href);
  }

  for (const group of NAVIGATION_GROUPS) {
    const members = group.hrefs.map((href) => byHref.get(href)).filter((item): item is T => Boolean(item));
    if (members.length === 0) continue;
    for (const member of members) placed.add(member.href);
    groups.push({ label: group.label, items: members });
  }

  const leftovers = pool.filter((item) => !placed.has(item.href));
  if (leftovers.length > 0) groups.push({ label: 'More', items: leftovers });
  return groups;
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
  Today: 'اليوم',
  Scan: 'مسح',
  Alerts: 'التنبيهات',
  Approvals: 'الاعتمادات',
  Account: 'حسابي',
  More: 'المزيد',
  Work: 'العمل',
  People: 'الأشخاص',
  Site: 'الموقع',
  Admin: 'الإدارة',
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
