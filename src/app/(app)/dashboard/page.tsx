
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
import { listGeoRegions, type GeoRegion } from '@/lib/location-governance-api';
import { useSession } from '@/providers/session-provider';
import { usePolling } from '@/lib/polling';
import { useLiveEvents } from '@/hooks/use-live-events';
import { OperationsCommandStrip } from '@/components/dashboard/operations-command-strip';
import { OperationsActionQueue } from '@/components/dashboard/operations-action-queue';
import { SiteOccupancyList } from '@/components/dashboard/site-occupancy-list';
import { OpsMap, type OpsZone } from '@/components/maps/ops-map';
import { Loader2, MapPinned, Radar } from 'lucide-react';

export default function DashboardPage() {
    const { currentUser, loading, isAuthorized, UnauthorizedComponent } = useAuthProtection(['Admin', 'Operator Admin', 'Manager', 'Supervisor']);
    const { token } = useSession();
    const [sites, setSites] = useState<Site[]>([]);
    const [operators, setOperators] = useState<Operator[]>([]);
    const [summary, setSummary] = useState<DashboardSummary | null>(null);
    const [zones, setZones] = useState<GeoRegion[]>([]);
    const [loadingZones, setLoadingZones] = useState(true);
    const [loadingData, setLoadingData] = useState(true);
    const [loadingSummary, setLoadingSummary] = useState(true);
    const [selectedOperatorId, setSelectedOperatorId] = useState<string>('all');
    const [selectedSiteId, setSelectedSiteId] = useState<string>('all');

    const userRole = currentUser?.role;
    const userId = currentUser?.id;
    const userOperatorId = currentUser?.operatorId;
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

    const fetchZones = useCallback(async () => {
        if (!token || !userRole || !canViewFullDashboard) {
            setLoadingZones(false);
            return;
        }

        setLoadingZones(true);
        try {
            const regions = await listGeoRegions(token, { includeInactive: true });
            setZones(regions);
        } catch (error) {
            console.error('Failed to fetch monitored zones', error);
        } finally {
            setLoadingZones(false);
        }
    }, [token, userRole, canViewFullDashboard]);

    useEffect(() => {
        fetchReferenceData();
    }, [fetchReferenceData]);

    useEffect(() => {
        fetchSummary();
    }, [fetchSummary]);

    useEffect(() => {
        fetchZones();
    }, [fetchZones]);

    // Live: refresh occupancy / recent activity / request counts the moment the backend reports a relevant change.
    // Polling drops to a slow safety-net interval since the stream now carries the immediacy.
    useLiveEvents(
        useCallback((event) => {
            if (
                event.type === 'GateActivityChanged' ||
                event.type === 'AccessRequestChanged' ||
                event.type === 'PresenceChanged' ||
                event.type === 'DashboardRefresh'
            ) {
                void fetchSummary();
            }
        }, [fetchSummary]),
        { enabled: canViewFullDashboard }
    );

    usePolling(() => {
        void fetchSummary();
    }, 45000);

    const opsZones = useMemo<OpsZone[]>(() => {
        return zones.map((region) => {
            const hasCenter =
                region.centerLatitude !== null &&
                region.centerLatitude !== undefined &&
                region.centerLongitude !== null &&
                region.centerLongitude !== undefined;

            return {
                id: region.id,
                name: region.name,
                shape: region.shape,
                center: hasCenter
                    ? ([region.centerLatitude as number, region.centerLongitude as number] as [number, number])
                    : null,
                radiusMeters: region.radiusMeters,
                polygon: (region.polygon ?? []).map((p) => [p.latitude, p.longitude] as [number, number]),
                tone:
                    region.governanceMode === 'Disabled'
                        ? 'muted'
                        : region.shape === 'Polygon'
                            ? 'teal'
                            : 'primary',
                meta: region.siteName || region.governanceMode,
                active: region.isActive,
            };
        });
    }, [zones]);

    const hasMappableZones = useMemo(
        () => opsZones.some((z) => (z.center && z.center.length === 2) || (z.polygon && z.polygon.length > 0)),
        [opsZones]
    );

    if (loading) {
        return <div>Loading...</div>;
    }

    if (!isAuthorized) {
        return <UnauthorizedComponent />;
    }

  if (!currentUser || !['Admin', 'Operator Admin', 'Manager', 'Supervisor'].includes(currentUser.role)) {
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
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-end md:justify-between">
        <div>
            <p className="eyebrow">Operations</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Operations Command Center</h1>
            <p className="mt-1 text-sm text-muted-foreground">Command view for personnel presence, approvals, and gate movement.</p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <span className="inline-flex w-fit items-center gap-2 self-start rounded-full border border-success/30 bg-success/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-success sm:self-auto">
                <span className="status-dot status-dot--live" />
                Live
            </span>
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
        <div className="space-y-6">
            <OperationsCommandStrip summary={summary} isLoading={loadingSummary} />
            <StatsCards summary={summary} isLoading={loadingSummary} />

            {/* Compliance ledger — cleared workforce, credentials expiring soon, and flagged workers. */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="ops-panel rounded-lg border border-success/30 bg-success/5 p-4">
                <span className="eyebrow text-success">Cleared workforce</span>
                <p className="metric-value mt-1 text-2xl font-bold text-success">{summary?.clearedWorkers ?? 0}</p>
                <p className="text-xs text-muted-foreground">Workers verified through onboarding</p>
              </div>
              <div className="ops-panel rounded-lg border border-warning/30 bg-warning/5 p-4">
                <span className="eyebrow text-warning">Expiring soon</span>
                <p className="metric-value mt-1 text-2xl font-bold text-warning">{summary?.workersWithExpiringCertificates ?? 0}</p>
                <p className="text-xs text-muted-foreground">Workers with a certificate lapsing within 30 days</p>
              </div>
              <div className="ops-panel rounded-lg border border-danger/30 bg-danger/5 p-4">
                <span className="eyebrow text-danger">Flagged</span>
                <p className="metric-value mt-1 text-2xl font-bold text-danger">{summary?.flaggedWorkers ?? 0}</p>
                <p className="text-xs text-muted-foreground">Clearance returned for correction</p>
              </div>
            </div>

            <section className="ops-panel p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <MapPinned className="h-4 w-4 text-accent" />
                        <div>
                            <h2 className="text-sm font-semibold text-foreground">Monitored Zones</h2>
                            <p className="text-xs text-muted-foreground">Geofenced operational regions across the selected scope.</p>
                        </div>
                    </div>
                    <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex">
                        <Radar className="h-3.5 w-3.5 text-accent" />
                        {loadingZones ? 'Loading…' : `${opsZones.length} zone${opsZones.length === 1 ? '' : 's'}`}
                    </span>
                </div>
                {loadingZones ? (
                    <div className="flex h-[520px] w-full items-center justify-center rounded-lg border border-border/70 bg-card/60">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                ) : hasMappableZones ? (
                    <OpsMap zones={opsZones} className="h-[520px] w-full rounded-lg overflow-hidden" />
                ) : (
                    <div className="flex h-[520px] w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 text-center">
                        <MapPinned className="h-8 w-8 text-muted-foreground/60" />
                        <p className="text-sm font-medium text-foreground">No mapped zones</p>
                        <p className="max-w-sm text-xs text-muted-foreground">
                            No geofenced regions with coordinates are configured for this scope yet.
                        </p>
                    </div>
                )}
            </section>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
                <div className="grid gap-6 lg:grid-cols-7">
                    <OnSiteByCompanyChart
                        className="lg:col-span-4"
                        data={userRole === 'Admin' && selectedOperatorId === 'all' ? summary?.operators ?? [] : summary?.contractors ?? []}
                        groupByOperator={userRole === 'Admin' && selectedOperatorId === 'all'}
                        isLoading={loadingSummary}
                    />
                    <OnSiteByNationalityChart className="lg:col-span-3" data={summary?.nationalities ?? []} isLoading={loadingSummary} />
                </div>
                <div className="space-y-6">
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
