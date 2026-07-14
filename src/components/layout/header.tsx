
'use client';
import { SidebarTrigger } from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Search, Bell, LifeBuoy, LogOut, Settings, User as UserIcon, Undo2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/providers/session-provider';
import { fetchAlerts } from '@/lib/api';
import { usePolling } from '@/lib/polling';
import { useLiveEvents } from '@/hooks/use-live-events';

const ALERT_VIEWER_ROLES = ['Admin', 'Operator Admin', 'Manager', 'Security'];

function UtcClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const time = now
    ? now.toISOString().slice(11, 19) // HH:MM:SS from the UTC ISO string
    : '--:--:--';

  return (
    <div className="hidden flex-col items-end leading-none lg:flex">
      <span className="eyebrow text-[10px] tracking-[0.18em]">UTC</span>
      <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
        {time}
      </span>
    </div>
  );
}

export function Header() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, token, logout, isImpersonating, impersonatedBy, stopImpersonation } = useSession();
  const [alertCount, setAlertCount] = useState(0);
  const canViewAlerts = !!user && ALERT_VIEWER_ROLES.includes(user.role);

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

  const handleLogout = () => {
    logout();
    toast({ title: 'Logged Out', description: 'You have been successfully logged out.' });
    router.push('/login');
  };

  const handleStopImpersonation = async () => {
    await stopImpersonation();
    toast({ title: 'Impersonation ended', description: 'You are back in your admin session.' });
    router.push('/companies');
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  }

  return (
    <header className="sticky top-0 z-20 flex min-h-16 flex-wrap items-center gap-3 border-b border-border bg-background/80 px-4 py-2 backdrop-blur md:gap-4 md:px-6">
      {/* Left: sidebar toggle + page context */}
      <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
      <div className="hidden items-center gap-2 md:flex">
        <span className="eyebrow">Operations</span>
        <span className="h-3 w-px bg-border" aria-hidden="true" />
        <span className="text-sm font-semibold text-foreground">Command Center</span>
      </div>

      {/* Center: global search */}
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search personnel, sites, requests…"
          className="w-full rounded-lg border-border bg-muted/40 pl-9 text-sm placeholder:text-muted-foreground focus-visible:ring-primary/40 md:w-[260px] lg:w-[360px]"
        />
      </div>

      {/* Right cluster: clock, system status, env, alerts, user */}
      <div className="flex items-center gap-3 md:gap-4">
        <UtcClock />

        <span className="hidden h-8 w-px bg-border lg:block" aria-hidden="true" />

        {/* SYSTEM status pill */}
        <div className="hidden items-center gap-2 rounded-full border border-success/30 bg-success/15 px-3 py-1.5 md:flex">
          <span className="status-dot status-dot--live" aria-hidden="true" />
          <div className="flex flex-col leading-none">
            <span className="eyebrow text-[9px] leading-none tracking-[0.18em]">System</span>
            <span className="text-xs font-semibold tracking-wide text-success">OPERATIONAL</span>
          </div>
        </div>

        {/* Environment badge */}
        <span className="hidden rounded-md border border-warning/30 bg-warning/15 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-warning sm:inline-block">
          DEV
        </span>

        {isImpersonating && (
          <div className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-2 py-1">
            <Badge variant="outline" className="border-warning/50 text-warning">
              Impersonating
            </Badge>
            <span className="hidden max-w-[220px] truncate text-xs text-muted-foreground lg:inline">
              {user?.name}
              {impersonatedBy ? ` via ${impersonatedBy.name}` : ''}
            </span>
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={handleStopImpersonation}>
              <Undo2 className="mr-1 h-3.5 w-3.5" />
              Return
            </Button>
          </div>
        )}

        {/* Alerts — live unacknowledged count, links to the alerts page */}
        {canViewAlerts && (
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="relative rounded-full text-muted-foreground hover:text-foreground"
          >
            <Link href="/alerts">
              <Bell className="h-5 w-5" />
              {alertCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white ring-2 ring-background">
                  {alertCount > 99 ? '99+' : alertCount}
                </span>
              )}
              <span className="sr-only">{alertCount > 0 ? `${alertCount} unacknowledged alerts` : 'View alerts'}</span>
            </Link>
          </Button>
        )}

        <span className="hidden h-8 w-px bg-border md:block" aria-hidden="true" />

        {/* User avatar + name/role */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex h-auto items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-muted/50"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary ring-1 ring-primary/25">
                {user ? getInitials(user.name) : <UserIcon className="h-4 w-4" />}
              </div>
              <div className="hidden flex-col items-start leading-tight md:flex">
                <span className="text-sm font-semibold text-foreground">
                  {user?.name || 'Loading…'}
                </span>
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {user?.role || '—'}
                </span>
              </div>
              <span className="sr-only">Toggle user menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user?.name || 'Loading...'}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user?.email || ''}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {isImpersonating && (
              <>
                <DropdownMenuItem onClick={handleStopImpersonation}>
                  <Undo2 className="mr-2 h-4 w-4" />
                  <span>Return to admin</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem asChild>
              <Link href="/profile"><UserIcon className="mr-2 h-4 w-4" /><span>Profile</span></Link>
            </DropdownMenuItem>
            <DropdownMenuItem><Settings className="mr-2 h-4 w-4" /><span>Settings</span></DropdownMenuItem>
            <DropdownMenuItem><LifeBuoy className="mr-2 h-4 w-4" /><span>Support</span></DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}><LogOut className="mr-2 h-4 w-4" /><span>Log out</span></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
