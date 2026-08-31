
'use client';

import {
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
} from '@/components/ui/sidebar';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  ShieldCheck,
  Building2,
  FileBadge,
  LogOut,
  Briefcase,
  User as UserIcon,
  ClipboardCheck,
  MapPinned,
  BellRing,
  Siren,
  CreditCard,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/providers/session-provider';
import { useEffect, useMemo, useState } from 'react';
import { getNavigationForRole } from './sidebar-navigation';
import { BACKEND_URL } from '@/lib/api';


const GatePassLogo = () => (
  <div className="flex items-center gap-3">
    <div className="flex h-10 w-10 items-center justify-center bg-primary rounded-lg">
      <ShieldCheck className="text-primary-foreground h-6 w-6" />
    </div>
    <span className="text-xl font-bold text-foreground">GatePass</span>
  </div>
);

const dashboardLabels: Record<string, string> = {
  '/access-requests': 'Site Access',
  '/location-governance': 'Geofencing',
  '/sites': 'Sites',
  '/profile': 'My Account',
};

export function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const { user, logout } = useSession();
  const [systemStatus, setSystemStatus] = useState<'checking' | 'operational' | 'degraded'>('checking');

  useEffect(() => {
    let disposed = false;
    const checkHealth = async () => {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 5_000);
      try {
        const response = await fetch(`${BACKEND_URL}/health/ready`, {
          method: 'GET',
          credentials: 'omit',
          signal: controller.signal,
        });
        if (!disposed) setSystemStatus(response.ok ? 'operational' : 'degraded');
      } catch {
        if (!disposed) setSystemStatus('degraded');
      } finally {
        window.clearTimeout(timer);
      }
    };
    void checkHealth();
    const interval = window.setInterval(checkHealth, 60_000);
    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, []);
  
  const navItems = useMemo(() => {
    const role = user?.role;
    if (!role) return [];

    const icons = {
      '/dashboard': LayoutDashboard,
      '/access-requests': ClipboardList,
      '/alerts': BellRing,
      '/muster': Siren,
      '/card-verification': CreditCard,
      '/inspections': ClipboardCheck,
      '/location-governance': MapPinned,
      '/projects': Briefcase,
      '/sites': Building2,
      '/companies': Briefcase,
      '/users': Users,
      '/certificates': FileBadge,
      '/profile': UserIcon,
      '/notifications': BellRing,
    } as const;
    return getNavigationForRole(role, { externalCompany: Boolean(user?.contractorId) }).map((item) => ({
      ...item,
      icon: icons[item.href as keyof typeof icons],
    }));
  }, [user]);


  const handleLogout = () => {
    logout();
    toast({ title: 'Logged Out', description: 'You have been successfully logged out.' });
    router.push('/login');
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  }

  return (
    <>
      <SidebarHeader className="p-4">
        <div className="group-data-[collapsible=icon]:hidden">
          <GatePassLogo />
        </div>
        <div className="hidden group-data-[collapsible=icon]:block">
           <div className="flex h-10 w-10 items-center justify-center bg-primary rounded-lg">
             <ShieldCheck className="text-primary-foreground h-6 w-6" />
           </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="px-2 py-2">
        <SidebarGroup className="py-1">
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <Link href={item.href}>
                  <SidebarMenuButton
                    isActive={pathname.startsWith(item.href)}
                    tooltip={{ children: item.label, side: 'right' }}
                  >
                    <item.icon />
                    <span>{pathname === '/dashboard' ? dashboardLabels[item.href] ?? item.label : item.label}</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-2 flex-col gap-2">
        <div className="flex items-center gap-2 rounded-lg bg-sidebar-accent/40 px-3 py-2 group-data-[collapsible=icon]:hidden">
          <span className={`status-dot ${systemStatus === 'operational' ? 'status-dot--live' : systemStatus === 'degraded' ? 'bg-destructive' : 'bg-warning'}`} />
          <span className="text-xs font-medium text-sidebar-foreground/80">
            {systemStatus === 'operational' ? 'All systems operational' : systemStatus === 'degraded' ? 'Service degraded' : 'Checking systems…'}
          </span>
        </div>
        <Separator className="bg-sidebar-border/50 my-1" />
        <div className="flex items-center gap-3 p-2">
              <div className="h-10 w-10 flex items-center justify-center rounded-full bg-sidebar-accent text-sidebar-accent-foreground font-semibold">
                 {user ? getInitials(user.name) : <UserIcon />}
              </div>
            <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="font-semibold text-sm text-sidebar-foreground">{user?.name || 'Loading...'}</span>
            <span className="text-xs text-sidebar-foreground/70">{user?.email || ''}</span>
          </div>
        </div>
         <SidebarMenu>
            <SidebarMenuItem>
                <SidebarMenuButton onClick={handleLogout} tooltip={{children: 'Logout', side: 'right'}}>
                  <LogOut/>
                  <span>Logout</span>
                </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
      </SidebarFooter>
    </>
  );
}
