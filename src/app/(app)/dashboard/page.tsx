
'use client';
import { useState, useEffect, useMemo } from 'react';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { StatsCards } from '@/components/dashboard/stats-cards';
import { useAuthProtection } from '@/hooks/use-auth-protection';
import type { Site, GateActivity, User, Operator, Contractor } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { RecentActivityTable } from '@/components/dashboard/recent-activity-table';
import { OnSiteByCompanyChart } from '@/components/dashboard/on-site-by-company-chart';
import { OnSiteByNationalityChart } from '@/components/dashboard/on-site-by-nationality-chart';

export default function DashboardPage() {
    const { firestoreUser, loading, isAuthorized, UnauthorizedComponent } = useAuthProtection(['Admin', 'Operator Admin', 'Manager', 'Security', 'Supervisor']);
    const firestore = useFirestore();
    const [sites, setSites] = useState<Site[]>([]);
    const [operators, setOperators] = useState<Operator[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [gateActivity, setGateActivity] = useState<GateActivity[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [selectedOperatorId, setSelectedOperatorId] = useState<string>('all');
    const [selectedSiteId, setSelectedSiteId] = useState<string>('all');

    const canViewFullDashboard = firestoreUser && ['Admin', 'Operator Admin', 'Manager'].includes(firestoreUser.role);
    const isAdmin = firestoreUser?.role === 'Admin';


    const filteredSites = useMemo(() => {
        if (selectedOperatorId === 'all') {
             if (firestoreUser?.role === 'Operator Admin') {
                return sites.filter(s => s.operatorId === firestoreUser.operatorId);
            }
            if (firestoreUser?.role === 'Manager') {
                return sites.filter(s => firestoreUser.id && s.managerIds.includes(firestoreUser.id));
            }
            return sites;
        }
        
        return sites.filter(s => s.operatorId === selectedOperatorId);

    }, [sites, selectedOperatorId, firestoreUser]);

    // When operator changes, reset the site filter
    useEffect(() => {
        setSelectedSiteId('all');
    }, [selectedOperatorId]);


     useEffect(() => {
        if (!firestore || !firestoreUser) {
            setLoadingData(false);
            return;
        }
        setLoadingData(true);
        const unsubs: (()=>void)[] = [];

        // Fetch all base data needed for filtering
        const fetchBaseData = async () => {
            if (isAdmin) {
                unsubs.push(onSnapshot(collection(firestore, "operators"), snap => setOperators(snap.docs.map(d => ({id: d.id, ...d.data()} as Operator)))));
            }

            let sitesQuery;
            if (firestoreUser.role === 'Operator Admin') {
                sitesQuery = query(collection(firestore, "sites"), where('operatorId', '==', firestoreUser.operatorId));
            } else if (firestoreUser.role === 'Manager') {
                sitesQuery = query(collection(firestore, 'sites'), where('managerIds', 'array-contains', firestoreUser.id));
            } else { // Admin or other roles
                sitesQuery = collection(firestore, "sites");
            }
            const sitesSnapshot = await getDocs(sitesQuery);
            const sitesData = sitesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Site));
            setSites(sitesData);
            
            // Fetch all users to map names to activity
            const usersSnapshot = await getDocs(collection(firestore, 'users'));
            const usersData = usersSnapshot.docs.map(doc => ({...doc.data(), id: doc.id} as User));
            setUsers(usersData);

            setLoadingData(false);
        };
        
        fetchBaseData();

        const setupActivityListener = () => {
            let activityQuery;
            
            if (selectedSiteId !== 'all') {
                activityQuery = query(collection(firestore, "gateActivity"), where('siteId', '==', selectedSiteId));
            } 
            else if (selectedOperatorId !== 'all') {
                const operatorSiteIds = sites.filter(s => s.operatorId === selectedOperatorId).map(s => s.id);
                if (operatorSiteIds.length > 0) {
                    activityQuery = query(collection(firestore, 'gateActivity'), where('siteId', 'in', operatorSiteIds));
                }
            } 
            else {
                let siteIdsToFilter: string[] = [];
                if (firestoreUser.role === 'Manager' && firestoreUser.id) {
                    siteIdsToFilter = sites.filter(s => s.managerIds.includes(firestoreUser.id!)).map(s => s.id);
                } else if (firestoreUser.role === 'Operator Admin') {
                    siteIdsToFilter = sites.filter(s => s.operatorId === firestoreUser.operatorId).map(s => s.id);
                } else if (firestoreUser.role === 'Admin') {
                     activityQuery = collection(firestore, "gateActivity");
                }

                if (siteIdsToFilter.length > 0 && !activityQuery) {
                    activityQuery = query(collection(firestore, 'gateActivity'), where('siteId', 'in', siteIdsToFilter));
                }
            }
            
            if (activityQuery) {
                unsubs.push(onSnapshot(activityQuery, (snapshot) => {
                    const activityData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GateActivity));
                    setGateActivity(activityData);
                }));
            } else {
                setGateActivity([]);
            }
        };

        // Call this after base data might have changed.
        setupActivityListener();


        return () => unsubs.forEach(unsub => unsub());
    }, [firestore, firestoreUser, selectedSiteId, selectedOperatorId, isAdmin]); // Rerun when filters change
    
    if (loading) {
        return <div>Loading...</div>;
    }
    
    if (!isAuthorized) {
        return <UnauthorizedComponent />;
    }

  if (!firestoreUser || !['Admin', 'Operator Admin', 'Manager', 'Security', 'Supervisor'].includes(firestoreUser.role)) {
      return (
         <div className="space-y-4 md:space-y-6">
            <header>
                <h1 className="text-3xl font-bold tracking-tight">Welcome</h1>
                <p className="text-muted-foreground">Your role does not have a dashboard view.</p>
            </header>
         </div>
      );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">Live overview of gate activity and security status.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
            {isAdmin && (
                 loadingData ? (
                    <Skeleton className="h-10 w-full md:w-[200px]" />
                ) : (
                    <Select value={selectedOperatorId} onValueChange={setSelectedOperatorId}>
                        <SelectTrigger className="w-full md:w-[200px]">
                            <SelectValue placeholder="Select an operator" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Operators</SelectItem>
                            {operators.map(op => (
                                <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )
            )}
            {canViewFullDashboard && (
                loadingData ? (
                    <Skeleton className="h-10 w-full md:w-[200px]" />
                ) : (
                    <Select value={selectedSiteId} onValueChange={setSelectedSiteId} disabled={isAdmin && selectedOperatorId === 'all'}>
                        <SelectTrigger className="w-full md:w-[200px]">
                            <SelectValue placeholder="Select a site" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Sites</SelectItem>
                            {filteredSites.map(site => (
                                <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )
            )}
        </div>
      </header>

      {canViewFullDashboard && (
        <div className="space-y-4 md:space-y-6">
            <StatsCards siteId={selectedSiteId} operatorId={selectedOperatorId} />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <OnSiteByCompanyChart className="lg:col-span-4" operatorId={selectedOperatorId} siteId={selectedSiteId} />
                <OnSiteByNationalityChart className="lg:col-span-3" operatorId={selectedOperatorId} siteId={selectedSiteId} />
            </div>
            <RecentActivityTable activity={gateActivity} users={users} sites={sites} isLoading={loadingData} />
        </div>
      )}

       {!canViewFullDashboard && (
          <p className="text-muted-foreground">Dashboard view is not available for your role.</p>
       )}
    </div>
  );
}

    