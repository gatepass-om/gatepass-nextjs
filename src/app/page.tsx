'use client';

import { useSession } from '@/providers/session-provider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { UserRole } from '@/lib/types';

const getHomepageForRole = (role?: UserRole): string => {
  switch (role) {
    case 'Contractor Admin':
      return '/access-requests';
    default:
      return '/dashboard';
  }
};

export default function Home() {
  const { user, loading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/login');
      return;
    }

    router.push(getHomepageForRole(user.role));
  }, [user, loading, router]);

  return <div>Loading...</div>;
}
