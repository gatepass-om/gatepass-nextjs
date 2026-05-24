
'use client';

import { useState, useEffect } from 'react';
import { useSession } from '@/providers/session-provider';
import { fetchWorkerRequest } from '@/lib/api';
import type { WorkerProfile } from '@/lib/types';

export function useWorkerData(workerId: string | undefined) {
  const { token } = useSession();
  const [workerData, setWorkerData] = useState<WorkerProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workerId || !token) {
      setWorkerData(null);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchWorkerRequest(token, workerId);
        setWorkerData(result);
      } catch (err: any) {
        const message = err?.message || 'Failed to fetch worker data';
        if (message.toLowerCase().includes('not found')) {
          setWorkerData(null);
        } else {
          setError(message);
          console.error(err);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [workerId, token]);

  return { workerData, loading, error };
}
