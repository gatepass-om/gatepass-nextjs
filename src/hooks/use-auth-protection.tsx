
'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from '@/providers/session-provider';
import type { User as UserType, UserRole } from '@/lib/types';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

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

  const UnauthorizedComponent = () => (
    <div className="flex items-center justify-center h-full min-h-[calc(100vh-10rem)]">
      <Alert variant="destructive" className="max-w-md">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>
          You do not have permission to view this page.
        </AlertDescription>
      </Alert>
    </div>
  );

  const isAuthorized = !!user && allowedRoles.includes(user.role);

  return {
    user,
    firestoreUser: user as UserType | null,
    loading,
    isAuthorized,
    UnauthorizedComponent,
  };
}
