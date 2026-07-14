
'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from '@/providers/session-provider';
import type { UserRole } from '@/lib/types';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ArrowLeft } from 'lucide-react';

const defaultLandingByRole: Record<UserRole, string> = {
  Admin: '/dashboard',
  'Operator Admin': '/dashboard',
  Manager: '/dashboard',
  Security: '/scan',
  'Contractor Admin': '/access-requests',
  Supervisor: '/access-requests',
  Worker: '/permits',
  Visitor: '/profile',
  Consultant: '/access-requests',
  Inspector: '/scan',
};

export function useAuthProtection(allowedRoles: UserRole[]) {
  const { user, loading } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    if (!user && pathname !== '/login') {
      router.push('/login');
    }
  }, [user, loading, pathname, router]);

  const UnauthorizedComponent = () => {
    const landing = user ? defaultLandingByRole[user.role] : '/login';

    return (
      <div className="flex items-center justify-center h-full min-h-[calc(100vh-10rem)]">
        <Alert variant="destructive" className="max-w-xl">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription className="mt-2 space-y-4">
          <div className="space-y-1">
            <p>You do not have permission to view this page.</p>
            <p className="text-sm">
              Denied route: <span className="font-medium">{pathname}</span>
            </p>
            <p className="text-sm">
              Current role: <span className="font-medium">{user?.role ?? 'Unauthenticated'}</span>
            </p>
          </div>
          <Button variant="outline" onClick={() => router.push(landing)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go to my workspace
          </Button>
        </AlertDescription>
      </Alert>
    </div>
    );
  };

  const isAuthorized = !!user && allowedRoles.includes(user.role);

  return {
    user,
    currentUser: user,
    loading,
    isAuthorized,
    UnauthorizedComponent,
  };
}
