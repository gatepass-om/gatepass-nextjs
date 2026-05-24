
'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { StatsCards } from '@/components/dashboard/stats-cards';
import { useAuthProtection } from '@/hooks/use-auth-protection';
import type { Site, Operator } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { RecentActivityTable } from '@/components/dashboard/recent-activity-table';
import { OnSiteByCompanyChart } from '@/components/dashboard/on-site-by-company-chart';
import { OnSiteByNationalityChart } from '@/components/dashboard/on-site-by-nationality-chart';
import { fetchDashboardSummaryRequest, listOperatorsRequest, listSitesRequest, type DashboardSummary } from '@/lib/api';
import { useSession } from '@/providers/session-provider';
import { usePolling } from '@/lib/polling';
import { OperationsCommandStrip } from '@/components/dashboard/operations-command-strip';
import { OperationsActionQueue } from '@/components/dashboard/operations-action-queue';
import { SiteOccupancyList } from '@/components/dashboard/site-occupancy-list';

export default function DashboardPage() {
    const { firestoreUser, loading, isAuthorized, UnauthorizedComponent } = useAuthProtection(['Admin', 'Operator Admin', 'Manager', 'Security', 'Supervisor']);
    const { token } = useSession();
    const [sites, setSites] = useState<Site[]>([]);
    const [operators, setOperators] = useState<Operator[]>([]);
    const [summary, setSummary] = useState<DashboardSummary | null>(null);
    const [loadingData, setLoadingData] = useState(true);
    const [loadingSummary, setLoadingSummary] = useState(true);
    const [selectedOperatorId, setSelectedOperatorId] = useState<string>('all');
    const [selectedSiteId, setSelectedSiteId] = useState<string>('all');

    const userRole = firestoreUser?.role;
    const userId = firestoreUser?.id;
    const userOperatorId = firestoreUser?.operatorId;
    const canViewFullDashboard = !!userRole && ['Admin', 'Operator Admin', 'Manager'].includes(userRole);
    const isAdmin = userRole === 'Admin';


    const filteredSites = useMemo(() => {
        if (selectedOperatorId === 'all') {
             if (userRole === 'Operator Admin') {
                return sites.filter(s => s.operatorId === userOperatorId);
            }
            if (userRole === 'Manager') {
                return sites.filter(s => userId && s.managerIds.includes(userId));
            }
            return sites;
        }
        
        return sites.filter(s => s.operatorId === selectedOperatorId);

    }, [sites, selectedOperatorId, userId, userOperatorId, userRole]);

    // When operator changes, reset the site filter
    useEffect(() => {
        setSelectedSiteId('all');
    }, [selectedOperatorId]);


    const fetchReferenceData = useCallback(async () => {
        if (!token || !userRole) {
            setLoadingData(false);
            return;
        }

        setLoadingData(true);
        try {
            let sitesData = [] as Site[];
            if (userRole === 'Operator Admin' && userOperatorId) {
                sitesData = await listSitesRequest(token, { operatorId: userOperatorId });
            } else {
                sitesData = await listSitesRequest(token);
            }

            const mappedSites = sitesData.map((site) => ({
                id: site.id,
                name: site.name,
                operatorId: (site as any).operator?.id ?? site.operatorId,
                managerIds: site.managerIds ?? [],
                requiredCertificates: site.requiredCertificates ?? [],
            })) as Site[];

            setSites(mappedSites);

            if (isAdmin) {
                const operatorsData = await listOperatorsRequest(token);
                setOperators(operatorsData as Operator[]);
            }
        } catch (error) {
            console.error('Failed to fetch dashboard reference data', error);
        } finally {
            setLoadingData(false);
        }
    }, [token, userRole, userOperatorId, isAdmin]);

    const fetchSummary = useCallback(async () => {
        if (!token || !userRole || !canViewFullDashboard) {
            setLoadingSummary(false);
            return;
        }

        setLoadingSummary(true);
        try {
            const nextSummary = await fetchDashboardSummaryRequest(token, {
                operatorId: selectedOperatorId,
                siteId: selectedSiteId,
            });
            setSummary(nextSummary);
        } catch (error) {
            console.error('Failed to fetch dashboard summary', error);
        } finally {
            setLoadingSummary(false);
        }
    }, [canViewFullDashboard, selectedOperatorId, selectedSiteId, token, userRole]);

    useEffect(() => {
        fetchReferenceData();
    }, [fetchReferenceData]);

    useEffect(() => {
        fetchSummary();
    }, [fetchSummary]);

    usePolling(() => {
        void fetchSummary();
    }, 15000);
    
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
    <div className="space-y-4 md:space-y-5">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
            <h1 className="text-2xl font-semibold tracking-tight">Operations Dashboard</h1>
            <p className="text-sm text-muted-foreground">Command view for personnel presence, approvals, and gate movement.</p>
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
        <div className="space-y-4 md:space-y-5">
            <OperationsCommandStrip summary={summary} isLoading={loadingSummary} />
            <StatsCards summary={summary} isLoading={loadingSummary} />
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
                <div className="grid gap-4 lg:grid-cols-7">
                    <OnSiteByCompanyChart
                        className="lg:col-span-4"
                        data={userRole === 'Admin' && selectedOperatorId === 'all' ? summary?.operators ?? [] : summary?.contractors ?? []}
                        groupByOperator={userRole === 'Admin' && selectedOperatorId === 'all'}
                        isLoading={loadingSummary}
                    />
                    <OnSiteByNationalityChart className="lg:col-span-3" data={summary?.nationalities ?? []} isLoading={loadingSummary} />
                </div>
                <div className="space-y-4">
                    <OperationsActionQueue summary={summary} isLoading={loadingSummary} />
                    <SiteOccupancyList sites={summary?.sites ?? []} totalOnSite={summary?.totalOnSite ?? 0} isLoading={loadingSummary} />
                </div>
            </div>
            <RecentActivityTable activity={summary?.recentActivity ?? []} isLoading={loadingSummary} />
        </div>
      )}

       {!canViewFullDashboard && (
          <p className="text-muted-foreground">Dashboard view is not available for your role.</p>
       )}
    </div>
  );
}
