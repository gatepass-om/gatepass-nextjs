'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, ChevronDown, Languages, LogOut, ShieldAlert, ShieldCheck, Undo2, User as UserIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/providers/session-provider';
import { BACKEND_URL, fetchAlerts, fetchUserNotifications } from '@/lib/api';
import { usePolling } from '@/lib/polling';
import { useLiveEvents } from '@/hooks/use-live-events';
import { useLocale } from '@/providers/locale-provider';
import { workspaceLandingForRole } from '@/lib/role-workspaces';
import { cn } from '@/lib/utils';
import { getNavigationForRole } from './sidebar-navigation';
import { arabicLabels, buildNavigationGroups, isActiveRoute } from './shell-navigation';

const ALERT_VIEWER_ROLES = ['Admin', 'Operator Admin', 'Manager', 'Security'];

type SystemStatus = 'checking' | 'operational' | 'degraded';

function useSystemStatus(): SystemStatus {
  const [status, setStatus] = useState<SystemStatus>('checking');
  useEffect(() => {
    let disposed = false;
    const check = async () => {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 5_000);
      try {
        const response = await fetch(`${BACKEND_URL}/health/ready`, { method: 'GET', credentials: 'omit', signal: controller.signal });
        if (!disposed) setStatus(response.ok ? 'operational' : 'degraded');
      } catch {
        if (!disposed) setStatus('degraded');
      } finally {
        window.clearTimeout(timer);
      }
    };
    void check();
    const interval = window.setInterval(check, 60_000);
    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, []);
  return status;
}

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const { user, token, logout, isImpersonating, impersonatedBy, stopImpersonation } = useSession();
  const { locale, setLocale, t } = useLocale();
  const systemStatus = useSystemStatus();
  const [alertCount, setAlertCount] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);
  const canViewAlerts = !!user && ALERT_VIEWER_ROLES.includes(user.role);

  const navGroups = useMemo(
    () => buildNavigationGroups(user?.role ? getNavigationForRole(user.role, { externalCompany: Boolean(user.contractorId) }) : []),
    [user],
  );

  const refreshAlertCount = useCallback(async () => {
    if (!token || !canViewAlerts) {
      setAlertCount(0);
      return;
    }
    try {
      const alerts = await fetchAlerts(token, { unacknowledgedOnly: true });
      setAlertCount(alerts.length);
    } catch {
      // The bell is best-effort; never surface an error toast from background polling.
    }
  }, [token, canViewAlerts]);

  useEffect(() => { void refreshAlertCount(); }, [refreshAlertCount]);
  const refreshNotificationCount = useCallback(async () => {
    if (!token) { setNotificationCount(0); return; }
    try { setNotificationCount((await fetchUserNotifications(token, true)).length); } catch { /* best effort */ }
  }, [token]);
  useEffect(() => { void refreshNotificationCount(); }, [refreshNotificationCount]);
  // Live: bump the badge the instant an alert is raised/dispatched. Polling stays as a slow safety net.
  useLiveEvents(
    useCallback((event) => {
      if (event.type === 'SiteAlertRaised' || event.type === 'NotificationDispatched') {
        void refreshAlertCount();
      }
    }, [refreshAlertCount]),
    { enabled: canViewAlerts }
  );
  usePolling(() => { void refreshAlertCount(); }, 45000);
  usePolling(() => { void refreshNotificationCount(); }, 30000);

  const handleLogout = () => {
    logout();
    toast({ title: t('Logged out'), description: t('You have been successfully logged out.') });
    router.push('/login');
  };

  const handleStopImpersonation = async () => {
    await stopImpersonation();
    toast({ title: t('Impersonation ended'), description: t('You are back in your admin session.') });
    router.push('/companies');
  };

  const getInitials = (name: string) => name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();
  const iconButton = 'relative rounded-full text-muted-foreground hover:text-foreground';
  const countBadge = 'absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none text-white ring-2 ring-card';

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card">
      <div className="mx-auto flex h-14 w-full max-w-[1440px] items-center gap-4 px-4 md:gap-6 md:px-8">
        <Link href={workspaceLandingForRole(user?.role)} className="flex shrink-0 items-center gap-2 font-semibold tracking-tight">
          <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
          <span className="text-base">GatePass</span>
        </Link>

        <nav aria-label={t('Main navigation', 'التنقل الرئيسي')} className="hidden min-w-0 flex-1 items-center gap-1 md:flex">
          {navGroups.map((group) => {
            const groupActive = group.items.some((item) => isActiveRoute(pathname, item.href));
            // A group of one is a link, not a menu you have to open to find a single page.
            if (group.items.length === 1) {
              const item = group.items[0];
              return (
                <Link
                  key={group.label}
                  href={item.href}
                  aria-current={groupActive ? 'page' : undefined}
                  className={cn(
                    'whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition-colors',
                    groupActive ? 'font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t(item.label, arabicLabels[item.label])}
                </Link>
              );
            }
            return (
              <DropdownMenu key={group.label}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      'inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition-colors',
                      groupActive ? 'font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {t(group.label, arabicLabels[group.label])}
                    <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52">
                  {group.items.map((item) => (
                    <DropdownMenuItem key={item.href} asChild>
                      <Link href={item.href} aria-current={isActiveRoute(pathname, item.href) ? 'page' : undefined}>
                        {t(item.label, arabicLabels[item.label])}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })}
        </nav>

        <div className="ms-auto flex items-center gap-1 md:gap-2">
          {isImpersonating && (
            <div className="me-1 hidden items-center gap-2 rounded-lg border border-warning/40 bg-warning-soft px-2 py-1 sm:flex">
              <Badge variant="warning">{t('Impersonating')}</Badge>
              <span className="hidden max-w-[220px] truncate text-xs text-muted-foreground lg:inline">
                {user?.name}
                {impersonatedBy ? ` ${t('via')} ${impersonatedBy.name}` : ''}
              </span>
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={handleStopImpersonation}>
                <Undo2 className="me-1 h-3.5 w-3.5" />
                {t('Return')}
              </Button>
            </div>
          )}

          {/* Alerts: live unacknowledged count, links to the alerts page */}
          {canViewAlerts && (
            <Button asChild variant="ghost" size="icon" className={iconButton}>
              <Link href="/alerts">
                <ShieldAlert className="h-5 w-5" />
                {alertCount > 0 && <span className={cn(countBadge, 'bg-danger')}>{alertCount > 99 ? '99+' : alertCount}</span>}
                <span className="sr-only">{alertCount > 0 ? `${alertCount} ${t('unacknowledged alerts')}` : t('View alerts')}</span>
              </Link>
            </Button>
          )}

          <Button asChild variant="ghost" size="icon" className={iconButton}>
            <Link href="/notifications">
              <Bell className="h-5 w-5" />
              {notificationCount > 0 ? <span className={cn(countBadge, 'bg-primary')}>{notificationCount > 99 ? '99+' : notificationCount}</span> : null}
              <span className="sr-only">{notificationCount ? `${notificationCount} ${t('unread notifications')}` : t('View notifications')}</span>
            </Link>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <span className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground',
                  isImpersonating && 'ring-2 ring-warning',
                )}>
                  {user ? getInitials(user.name) : <UserIcon className="h-4 w-4" />}
                </span>
                <span className="sr-only">{t('Toggle user menu')}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="font-normal">
                <p className="text-sm font-semibold leading-none">{user?.name || t('Loading…')}</p>
                <p className="mt-1.5 truncate text-xs text-muted-foreground">{user?.email || ''}</p>
                {user?.role ? <Badge variant="secondary" className="mt-2">{t(user.role)}</Badge> : null}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {isImpersonating && (
                <>
                  <DropdownMenuItem onClick={handleStopImpersonation}>
                    <Undo2 className="me-2 h-4 w-4" />
                    <span>{t('Return to admin')}</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem asChild>
                <Link href="/profile"><UserIcon className="me-2 h-4 w-4" /><span>{t('My Account', arabicLabels['My Account'])}</span></Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLocale(locale === 'en' ? 'ar' : 'en')}>
                <Languages className="me-2 h-4 w-4" />
                <span>{locale === 'en' ? 'العربية' : 'English'}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
                <span className={cn('status-dot', systemStatus === 'operational' ? 'status-dot--live' : systemStatus === 'degraded' ? 'bg-destructive' : 'bg-warning')} />
                {systemStatus === 'operational' ? t('All systems operational', 'جميع الأنظمة تعمل') : systemStatus === 'degraded' ? t('Service degraded', 'الخدمة متأثرة') : t('Checking systems…', 'جارٍ فحص الأنظمة…')}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}><LogOut className="me-2 h-4 w-4" /><span>{t('Log out')}</span></DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
