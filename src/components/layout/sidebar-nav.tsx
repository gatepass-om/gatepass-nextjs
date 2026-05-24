
'use client';

import {
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
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
    <span className="text-xl font-bold text-primary-foreground">GatePass</span>
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
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['Admin', 'Operator Admin', 'Manager', 'Security', 'Supervisor'] },
      { href: '/access-requests', label: 'Access Requests', icon: ClipboardList, roles: ['Admin', 'Operator Admin', 'Manager', 'Worker', 'Supervisor', 'Contractor Admin'] },
      { href: '/companies', label: 'Companies', icon: Briefcase, roles: ['Admin'] },
      { href: '/sites', label: 'Site Management', icon: Building2, roles: ['Admin', 'Operator Admin'] },
      { href: '/smart-access', label: 'Smart Access', icon: LockKeyhole, roles: ['Admin', 'Operator Admin', 'Manager', 'Security'] },
      { href: '/location-governance', label: 'Geofencing', icon: MapPinned, roles: ['Admin', 'Operator Admin', 'Manager', 'Security', 'Contractor Admin', 'Supervisor'] },
      { href: '/certificates', label: 'Certificates', icon: FileBadge, roles: ['Admin', 'Operator Admin'] },
      { href: '/users', label: 'Personnel', icon: Users, roles: ['Admin', 'Operator Admin', 'Contractor Admin'] },
      { href: '/permits', label: 'Permits to Work', icon: ClipboardCheck, roles: ['Admin', 'Operator Admin', 'Manager', 'Supervisor', 'Security'] },
      { href: '/scan', label: 'Scan', icon: ScanLine, roles: ['Security'] },
      { href: '/profile', label: 'My QR Code', icon: QrCodeIcon, roles: ['Worker', 'Visitor', 'Manager', 'Supervisor', 'Admin', 'Operator Admin'] },
    ];

    return allItems.filter(item => item.roles.includes(role));
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
      <SidebarContent className="p-2">
        <SidebarMenu>
          {navItems.map((item) => (
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
      </SidebarContent>
      <SidebarFooter className="p-2 flex-col gap-2">
        <Separator className="bg-sidebar-border/50 my-2" />
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
