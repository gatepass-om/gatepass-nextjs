
'use client';

import {
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useAuth, useFirestore } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase/auth/use-user';
import { doc, onSnapshot } from 'firebase/firestore';
import { useState, useEffect, useMemo } from 'react';
import type { User as UserType } from '@/lib/types';


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
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { user: authUser } = useUser();
  const firestore = useFirestore();
  const [firestoreUser, setFirestoreUser] = useState<UserType | null>(null);

  useEffect(() => {
    if (!authUser || !firestore) return;
    const userRef = doc(firestore, 'users', authUser.uid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
            setFirestoreUser(docSnap.data() as UserType);
        } else {
            setFirestoreUser(null);
        }
    });
    return () => unsubscribe();
  }, [authUser, firestore]);
  
  const navItems = useMemo(() => {
    const role = firestoreUser?.role;
    if (!role) return [];

    const allItems = [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['Admin', 'Operator Admin', 'Manager', 'Security', 'Supervisor'] },
      { href: '/access-requests', label: 'Access Requests', icon: ClipboardList, roles: ['Admin', 'Operator Admin', 'Manager', 'Worker', 'Supervisor', 'Contractor Admin'] },
      { href: '/companies', label: 'Companies', icon: Briefcase, roles: ['Admin'] },
      { href: '/sites', label: 'Site Management', icon: Building2, roles: ['Admin', 'Operator Admin'] },
      { href: '/certificates', label: 'Certificates', icon: FileBadge, roles: ['Admin'] },
      { href: '/users', label: 'Personnel', icon: Users, roles: ['Admin', 'Operator Admin', 'Contractor Admin'] },
      { href: '/scan', label: 'Scan', icon: ScanLine, roles: ['Security'] },
    ];

    return allItems.filter(item => item.roles.includes(role));
  }, [firestoreUser]);


  const handleLogout = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      toast({ title: 'Logged Out', description: 'You have been successfully logged out.' });
      router.push('/login');
    } catch (error) {
      console.error('Logout Error:', error);
      toast({ variant: 'destructive', title: 'Logout Failed', description: 'Could not log you out. Please try again.' });
    }
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
              {firestoreUser ? getInitials(firestoreUser.name) : <UserIcon />}
           </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="font-semibold text-sm text-sidebar-foreground">{firestoreUser?.name || 'Loading...'}</span>
            <span className="text-xs text-sidebar-foreground/70">{firestoreUser?.email || ''}</span>
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
