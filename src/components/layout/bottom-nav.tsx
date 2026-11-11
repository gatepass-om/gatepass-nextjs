'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Briefcase, MoreHorizontal } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useSession } from '@/providers/session-provider';
import { useLocale } from '@/providers/locale-provider';
import { cn } from '@/lib/utils';
import { getNavigationForRole } from './sidebar-navigation';
import { navIcons } from './nav-icons';
import { arabicLabels, isActiveRoute, splitForPhone, tabLabel } from './shell-navigation';

/** Phone-only navigation: the role's main pages as tabs, the rest in a sheet. */
export function BottomNav() {
  const pathname = usePathname();
  const { user } = useSession();
  const { t } = useLocale();
  const [open, setOpen] = useState(false);

  const { tabs, more } = useMemo(
    () => splitForPhone(user?.role ? getNavigationForRole(user.role, { externalCompany: Boolean(user.contractorId) }) : []),
    [user],
  );
  const moreIsActive = more.some((item) => isActiveRoute(pathname, item.href));

  useEffect(() => { setOpen(false); }, [pathname]);

  if (tabs.length === 0) return null;

  const tabClass = (active: boolean) => cn(
    'flex h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px] transition-colors',
    active ? 'font-semibold text-foreground' : 'text-muted-foreground',
  );

  return (
    <nav aria-label={t('Main navigation', 'التنقل الرئيسي')} className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="mx-auto flex max-w-md items-stretch justify-around px-1">
        {tabs.map((item) => {
          const Icon = navIcons[item.href] ?? Briefcase;
          const active = isActiveRoute(pathname, item.href);
          const label = tabLabel(item);
          return (
            <li key={item.href} className="min-w-0 flex-1">
              <Link href={item.href} aria-current={active ? 'page' : undefined} className={tabClass(active)}>
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span className="max-w-full truncate px-0.5">{t(label, arabicLabels[label])}</span>
              </Link>
            </li>
          );
        })}
        {more.length > 0 && (
          <li className="min-w-0 flex-1">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <button type="button" className={tabClass(moreIsActive)}>
                  <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
                  <span>{t('More', arabicLabels.More)}</span>
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-xl p-0 pb-[env(safe-area-inset-bottom)]">
                <SheetHeader className="px-5 pb-1 pt-5 text-start">
                  <SheetTitle className="text-base">{t('More', arabicLabels.More)}</SheetTitle>
                </SheetHeader>
                <ul className="px-2 pb-3">
                  {more.map((item) => {
                    const Icon = navIcons[item.href] ?? Briefcase;
                    const active = isActiveRoute(pathname, item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={active ? 'page' : undefined}
                          className={cn('flex items-center gap-3 rounded-lg px-3 py-3 text-sm', active ? 'font-semibold text-foreground' : 'text-muted-foreground')}
                        >
                          <Icon className="h-5 w-5" aria-hidden="true" />
                          {t(item.label, arabicLabels[item.label])}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </SheetContent>
            </Sheet>
          </li>
        )}
      </ul>
    </nav>
  );
}
