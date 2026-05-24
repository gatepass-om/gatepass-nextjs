
'use client';
import type { ReactNode } from 'react';
import {
  SidebarProvider,
  Sidebar,
  SidebarInset,
} from '@/components/ui/sidebar';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import { Header } from '@/components/layout/header';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import type { UserRole } from '@/lib/types';
import { useSession } from '@/providers/session-provider';

function AppLoadingSkeleton() {
  return (
    <div className="flex h-svh w-full">
      {/* Sidebar Skeleton */}
      <div className="hidden md:flex flex-col gap-4 h-full w-[16rem] bg-gray-900 p-4">
        <Skeleton className="h-10 w-3/4" />
        <div className="flex-1 space-y-2">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
        </div>
        <Skeleton className="h-12 w-full" />
      </div>
      {/* Main Content Skeleton */}
      <div className="flex-1 flex flex-col">
        <div className="h-16 border-b flex items-center justify-between px-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
        <main className="flex-1 p-8">
           <Skeleton className="h-8 w-1/4 mb-4" />
           <Skeleton className="h-4 w-1/2 mb-8" />
           <Skeleton className="h-64 w-full" />
        </main>
      </div>
    </div>
  )
}

const getHomepageForRole = (role?: UserRole): string => {
  switch (role) {
    case 'Contractor Admin':
      return '/access-requests';
    default:
      return '/dashboard';
  }
}

const publicRoutes = ['/login', '/activate-account'];

function LayoutContent({ children }: { children: ReactNode }) {
  const { user, token, loading, refresh } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const lastRefreshedPath = useRef<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user && !publicRoutes.includes(pathname)) {
      router.push('/login');
    }
  }, [loading, user, pathname, router]);

  useEffect(() => {
    if (loading || !user) return;
    const homePage = getHomepageForRole(user.role);
    if (user.status === 'Inactive' && pathname !== '/activate-account') {
      router.push('/activate-account');
    } else if (user.status === 'Active' && pathname === '/activate-account') {
      router.push(homePage);
    }
  }, [loading, user, pathname, router]);

  useEffect(() => {
    if (loading || !token || !user || publicRoutes.includes(pathname)) return;
    if (lastRefreshedPath.current === pathname) return;
    lastRefreshedPath.current = pathname;
    void refresh().catch(() => undefined);
  }, [loading, pathname, refresh, token, user]);

  const isPublic = publicRoutes.includes(pathname);
  if (loading && !isPublic) {
    return <AppLoadingSkeleton />;
  }

  if (!user && isPublic) {
    return <>{children}</>;
  }

  if (!user) {
    return <AppLoadingSkeleton />;
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarNav />
      </Sidebar>
      <SidebarInset>
        <div className="flex flex-col min-h-svh bg-background">
          <Header />
          <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return <LayoutContent>{children}</LayoutContent>;
}
