
'use client';
import type { ReactNode } from 'react';
import { Header } from '@/components/layout/header';
import { BottomNav } from '@/components/layout/bottom-nav';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useSession } from '@/providers/session-provider';
import { workspaceLandingForRole } from '@/lib/role-workspaces';

function AppLoadingSkeleton() {
  return (
    <div className="min-h-svh bg-background">
      <div className="flex h-14 items-center gap-6 border-b bg-card px-4 md:px-8">
        <Skeleton className="h-6 w-24" />
        <div className="hidden flex-1 gap-3 md:flex">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-5 w-20" />)}
        </div>
        <Skeleton className="ms-auto h-8 w-8 rounded-full" />
      </div>
      <main className="mx-auto max-w-[1440px] px-4 py-6 md:px-8">
        <Skeleton className="mb-4 h-8 w-1/4" />
        <Skeleton className="h-64 w-full" />
      </main>
    </div>
  );
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
    const homePage = workspaceLandingForRole(user.role);
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
    <div className="min-h-svh bg-background">
      <Header />
      <main className="mx-auto w-full max-w-[1440px] px-4 pb-28 pt-5 md:px-8 md:pb-10 md:pt-7">{children}</main>
      <BottomNav />
    </div>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return <LayoutContent>{children}</LayoutContent>;
}
