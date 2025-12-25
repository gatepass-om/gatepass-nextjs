
'use client';
import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query, where, getDocs, Query } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Users, LogIn } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { GateActivity, User } from '@/lib/types';
import { useAuthProtection } from '@/hooks/use-auth-protection';

interface StatsCardsProps {
    siteId: string;
    operatorId: string;
}

export function StatsCards({ siteId, operatorId }: StatsCardsProps) {
    const { firestoreUser, loading: authLoading } = useAuthProtection(['Admin', 'Operator Admin', 'Manager']);
    const firestore = useFirestore();
    const [stats, setStats] = useState({
        totalWorkers: 0,
        checkedIn: 0,
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!firestore || !firestoreUser) return;
        setLoading(true);

        const unsubs: (() => void)[] = [];
        const role = firestoreUser.role;
        const userId = firestoreUser.id;
        const isManager = role === 'Manager';
        const isOperatorAdmin = role === 'Operator Admin';

        const setupListeners = async () => {
            let sitesQuery: Query | null = null;
            if (siteId !== 'all') {
                sitesQuery = query(collection(firestore, 'sites'), where('__name__', '==', siteId));
            } else if (operatorId !== 'all') {
                sitesQuery = query(collection(firestore, 'sites'), where('operatorId', '==', operatorId));
            } else if (isManager) {
                sitesQuery = query(collection(firestore, 'sites'), where('managerIds', 'array-contains', userId));
            } else if (isOperatorAdmin) {
                sitesQuery = query(collection(firestore, 'sites'), where('operatorId', '==', firestoreUser.operatorId));
            } else { // Admin
                sitesQuery = collection(firestore, 'sites');
            }

            const filterSiteIds = sitesQuery ? (await getDocs(sitesQuery)).docs.map(d => d.id) : null;

            // Total Workers
            let usersQuery: Query = query(collection(firestore, 'users'), where('role', 'in', ['Worker', 'Visitor', 'Supervisor']));
            
            // This is a simplification. A more complex query might be needed if you need to associate workers
            // to an operator through contractor relationships on active requests.
            if (operatorId !== 'all') {
                usersQuery = query(usersQuery, where('operatorId', '==', operatorId));
            } else if (isOperatorAdmin) {
                 usersQuery = query(usersQuery, where('operatorId', '==', firestoreUser.operatorId));
            }

            unsubs.push(onSnapshot(usersQuery, (snapshot) => {
                setStats(prev => ({ ...prev, totalWorkers: snapshot.size }));
            }));

            // Checked-in count
            let activityQuery: Query | null = collection(firestore, 'gateActivity');
             if (filterSiteIds && filterSiteIds.length > 0) {
                activityQuery = query(activityQuery, where('siteId', 'in', filterSiteIds));
             } else if (siteId !== 'all' || (operatorId !== 'all' && (!filterSiteIds || filterSiteIds.length === 0))) {
                activityQuery = null;
             } else if (filterSiteIds?.length === 0 && role !== 'Admin' && operatorId === 'all') {
                activityQuery = null;
             }

            if (activityQuery) {
                unsubs.push(onSnapshot(activityQuery, (activitySnap) => {
                    onSnapshot(collection(firestore, 'users'), (usersSnap) => {
                        const activities = activitySnap.docs.map(doc => ({...doc.data(), id: doc.id}) as GateActivity);
                        const users = usersSnap.docs.map(doc => ({ ...doc.data(), id: doc.id }) as User);
                        
                        const userMap = new Map(users.map(u => [u.id, u]));
                        const latestActivity: Record<string, any> = {};
                        activities.forEach(activity => {
                            const timestamp = typeof activity.timestamp === 'string' ? new Date(activity.timestamp) : activity.timestamp.toDate();
                            if (!latestActivity[activity.userId] || timestamp > latestActivity[activity.userId].timestamp.toDate()) {
                                latestActivity[activity.userId] = activity;
                            }
                        });

                        let checkedInCount = 0;
                        Object.values(latestActivity).forEach(activity => {
                            if (activity.type === 'Check-in') {
                                checkedInCount++;
                            }
                        });
                        
                        setStats(prev => ({ ...prev, checkedIn: checkedInCount }));
                        setLoading(false);
                    })
                }));
            } else {
               setStats(prev => ({ ...prev, checkedIn: 0 }));
               setLoading(false);
            }
        };

        setupListeners();
        
        return () => unsubs.forEach(unsub => unsub());
    }, [firestore, firestoreUser, siteId, operatorId]);

    const renderCards = () => (
      <>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Workers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
            <div className="text-2xl font-bold">{stats.totalWorkers}</div>
            <p className="text-xs text-muted-foreground">Registered external personnel</p>
            </CardContent>
        </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Currently On-Site</CardTitle>
          <LogIn className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.checkedIn}</div>
           <p className="text-xs text-muted-foreground">Personnel on-site now</p>
        </CardContent>
      </Card>
      </>
    );

    if (authLoading || loading) {
        return (
             <div className="grid gap-4 md:grid-cols-2">
                {[...Array(2)].map((_, i) => (
                    <Card key={i}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <Skeleton className="h-4 w-[120px]" />
                        <Skeleton className="h-4 w-4" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-7 w-8" />
                        <Skeleton className="h-3 w-[100px] mt-1" />
                    </CardContent>
                    </Card>
                ))}
            </div>
        );
    }
  
  if (!firestoreUser) {
      return null;
  }


  return (
    <div className="grid gap-4 md:grid-cols-2">
      {renderCards()}
    </div>
  );
}
