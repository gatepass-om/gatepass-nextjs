'use client';

import { useSession } from '@/providers/session-provider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { workspaceLandingForRole } from '@/lib/role-workspaces';

export default function Home() {
  const { user, loading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/login');
      return;
    }

    router.push(workspaceLandingForRole(user.role));
  }, [user, loading, router]);

  return <div>Loading...</div>;
}
