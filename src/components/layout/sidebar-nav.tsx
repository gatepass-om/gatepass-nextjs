
'use client';

import {
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
} from '@/components/ui/sidebar';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  ScanLine,
  QrCode as QrCodeIcon,
  ShieldCheck,
  Building2,
  FileBadge,
  LogOut,
  Briefcase,
  User as UserIcon,
  LockKeyhole,
  ClipboardCheck,
  MapPinned,
  Video,
  BellRing,
  Siren,
  SlidersHorizontal,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/providers/session-provider';
import { useMemo } from 'react';


const GatePassLogo = () => (
  <div className="flex items-center gap-3">
    <div className="flex h-10 w-10 items-center justify-center bg-primary rounded-lg">
      <ShieldCheck className="text-primary-foreground h-6 w-6" />
    </div>
    <span className="text-xl font-bold text-foreground">GatePass</span>
  </div>
);

export function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const { user, logout } = useSession();
  
  const navItems = useMemo(() => {
    const role = user?.role;
    if (!role) return [];

    const allItems = [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Operations', roles: ['Admin', 'Operator Admin', 'Manager', 'Supervisor'] },
      { href: '/access-requests', label: 'Access Requests', icon: ClipboardList, group: 'Operations', roles: ['Admin', 'Operator Admin', 'Manager', 'Worker', 'Supervisor', 'Contractor Admin'] },
      { href: '/alerts', label: 'Alerts', icon: BellRing, group: 'Operations', roles: ['Admin', 'Operator Admin', 'Manager', 'Security'] },
      { href: '/muster', label: 'Muster', icon: Siren, group: 'Operations', roles: ['Admin', 'Operator Admin', 'Manager', 'Security'] },
      { href: '/scan', label: 'Scan Workstation', icon: ScanLine, group: 'Operations', roles: ['Security'] },
      { href: '/location-governance', label: 'Geofencing', icon: MapPinned, group: 'Governance', roles: ['Admin', 'Operator Admin', 'Manager', 'Contractor Admin', 'Supervisor'] },
      { href: '/decision-rules', label: 'Decision Rules', icon: SlidersHorizontal, group: 'Governance', roles: ['Admin'] },
      { href: '/surveillance', label: 'Surveillance', icon: Video, group: 'Governance', roles: ['Admin', 'Operator Admin', 'Manager'] },
      { href: '/permits', label: 'Permits to Work', icon: ClipboardCheck, group: 'Governance', roles: ['Admin', 'Operator Admin', 'Manager', 'Supervisor', 'Worker'] },
      { href: '/smart-access', label: 'Smart Access', icon: LockKeyhole, group: 'Infrastructure', roles: ['Admin', 'Operator Admin', 'Manager'] },
      { href: '/sites', label: 'Site Management', icon: Building2, group: 'Infrastructure', roles: ['Admin', 'Operator Admin'] },
      { href: '/companies', label: 'Companies', icon: Briefcase, group: 'Directory', roles: ['Admin', 'Operator Admin'] },
      { href: '/users', label: 'Personnel', icon: Users, group: 'Directory', roles: ['Admin', 'Operator Admin', 'Contractor Admin', 'Manager'] },
      { href: '/certificates', label: 'Certificates', icon: FileBadge, group: 'Directory', roles: ['Admin', 'Operator Admin'] },
      { href: '/profile', label: 'My QR Code', icon: QrCodeIcon, group: 'Account', roles: ['Worker', 'Visitor', 'Manager', 'Supervisor', 'Admin', 'Operator Admin', 'Security', 'Contractor Admin'] },
    ];

    const visible = allItems.filter(item => item.roles.includes(role));
    const order = ['Operations', 'Governance', 'Infrastructure', 'Directory', 'Account'];
    return order
      .map(group => ({ group, items: visible.filter(i => i.group === group) }))
      .filter(section => section.items.length > 0);
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
        {navItems.map((section) => (
          <SidebarGroup key={section.group} className="py-1">
            <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/40 group-data-[collapsible=icon]:hidden">
              {section.group}
            </SidebarGroupLabel>
            <SidebarMenu>
              {section.items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <Link href={item.href}>
                    <SidebarMenuButton
                      isActive={pathname.startsWith(item.href)}
                      tooltip={{ children: item.label, side: 'right' }}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="p-2 flex-col gap-2">
        <div className="flex items-center gap-2 rounded-lg bg-sidebar-accent/40 px-3 py-2 group-data-[collapsible=icon]:hidden">
          <span className="status-dot status-dot--live" />
          <span className="text-xs font-medium text-sidebar-foreground/80">All systems operational</span>
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
