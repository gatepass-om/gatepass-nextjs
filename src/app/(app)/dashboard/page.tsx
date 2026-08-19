'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Bell, MapPinned, Radio, Search, SlidersHorizontal } from 'lucide-react';
import { externalCompanyTypeLabel } from '@/components/compliance/compliance-model';
import { DashboardTools, type ReportingWindow } from '@/components/dashboard/dashboard-tools';
import { shouldShowAttendanceAnalytics } from '@/components/dashboard/dashboard-mode';
import { DataQualityPanel } from '@/components/dashboard/data-quality-panel';
import { InclusiveAdoptionPanel } from '@/components/dashboard/inclusive-adoption-panel';
import { ManagementScorecards } from '@/components/dashboard/management-scorecards';
import { OperationsActionQueue } from '@/components/dashboard/operations-action-queue';
import { RecentActivityTable } from '@/components/dashboard/recent-activity-table';
import { RegistrationFunnelPanel } from '@/components/dashboard/registration-funnel-panel';
import { ReportSchedulesPanel } from '@/components/dashboard/report-schedules-panel';
import { ShiftRostersPanel } from '@/components/dashboard/shift-rosters-panel';
import type { OpsPoint, OpsZone } from '@/components/maps/ops-map';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuthProtection } from '@/hooks/use-auth-protection';
import { useLiveEvents } from '@/hooks/use-live-events';
import {
  fetchDashboardSummaryRequest,
  listExternalCompaniesRequest,
  listOperatorsRequest,
  listSitesRequest,
  type DashboardSummary,
} from '@/lib/api';
import { listGeoRegions, type GeoRegion } from '@/lib/location-governance-api';
import { usePolling } from '@/lib/polling';
import type { Contractor, Operator, Site, UserRole } from '@/lib/types';
import { useSession } from '@/providers/session-provider';

const DashboardVisuals = dynamic(
  () => import('@/components/dashboard/dashboard-visuals').then((module) => module.DashboardVisuals),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[680px] w-full rounded-xl" />,
  },
);

const OpsMap = dynamic(
  () => import('@/components/maps/ops-map').then((module) => module.OpsMap),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[340px] w-full rounded-xl" />,
  },
);

const DASHBOARD_ROLES: UserRole[] = ['Admin', 'Operator Admin', 'Manager', 'Supervisor', 'Contractor Admin'];
const ROSTER_ROLES: UserRole[] = ['Admin', 'Operator Admin', 'Manager'];
const EMPTY_MAP_SITES: DashboardSummary['mapSites'] = [];

export default function DashboardPage() {
  const {
    currentUser,
    loading,
    isAuthorized,
    UnauthorizedComponent,
  } = useAuthProtection(DASHBOARD_ROLES);
  const { token } = useSession();
  const [sites, setSites] = useState<Site[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [externalCompanies, setExternalCompanies] = useState<Contractor[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [zones, setZones] = useState<GeoRegion[]>([]);
  const [loadingZones, setLoadingZones] = useState(true);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [selectedOperatorId, setSelectedOperatorId] = useState('all');
  const [selectedSiteId, setSelectedSiteId] = useState('all');
  const [selectedExternalCompanyId, setSelectedExternalCompanyId] = useState('all');
  const [requestStatusFilter, setRequestStatusFilter] = useState('all');
  const mapSiteSummaries = summary?.mapSites ?? EMPTY_MAP_SITES;
  const showAttendanceAnalytics = useMemo(
    () => shouldShowAttendanceAnalytics(
      sites,
      selectedOperatorId === 'all' ? undefined : selectedOperatorId,
      selectedSiteId === 'all' ? undefined : selectedSiteId,
    ),
    [selectedOperatorId, selectedSiteId, sites],
  );
  const [reportingWindow, setReportingWindow] = useState<ReportingWindow>('24h');
  const [customFromLocal, setCustomFromLocal] = useState(
    () => toLocalDateTimeValue(new Date(Date.now() - 24 * 60 * 60 * 1000)),
  );
  const [customToLocal, setCustomToLocal] = useState(() => toLocalDateTimeValue(new Date()));

  const userRole = currentUser?.role;
  const userId = currentUser?.id;
  const userOperatorId = currentUser?.operatorId;
  const isAdmin = userRole === 'Admin';
  const canManageRosters = !!userRole && ROSTER_ROLES.includes(userRole);
  const canScheduleReports = summary?.audience.visiblePanels.includes('portfolio') ?? false;
  const customRangeError = useMemo(
    () => reportingWindow === 'custom'
      ? validateCustomRange(customFromLocal, customToLocal)
      : null,
    [customFromLocal, customToLocal, reportingWindow],
  );

  const filteredSites = useMemo(() => {
    if (selectedOperatorId !== 'all') {
      return sites.filter((site) => site.operatorId === selectedOperatorId);
    }
    if (userRole === 'Operator Admin') {
      return sites.filter((site) => site.operatorId === userOperatorId);
    }
    if (userRole === 'Manager') {
      return sites.filter((site) => userId && site.managerIds.includes(userId));
    }
    return sites;
  }, [selectedOperatorId, sites, userId, userOperatorId, userRole]);

  useEffect(() => {
    setSelectedSiteId('all');
  }, [selectedOperatorId]);

  const fetchReferenceData = useCallback(async () => {
    if (!token || !userRole || !isAuthorized) {
      setLoadingData(false);
      return;
    }

    setLoadingData(true);
    try {
      const [sitesData, operatorsData, companiesData] = await Promise.all([
        userRole === 'Operator Admin' && userOperatorId
          ? listSitesRequest(token, { operatorId: userOperatorId })
          : listSitesRequest(token),
        isAdmin ? listOperatorsRequest(token) : Promise.resolve([]),
        listExternalCompaniesRequest(token),
      ]);

      setSites(sitesData.map((site) => ({
        id: site.id,
        name: site.name,
        operatorId: (site as Site & { operator?: { id?: string } }).operator?.id ?? site.operatorId,
        managerIds: site.managerIds ?? [],
        requiredCertificates: site.requiredCertificates ?? [],
        maximumOccupancy: site.maximumOccupancy ?? undefined,
      })));

      setOperators(operatorsData);
      setExternalCompanies(companiesData);
    } catch (error) {
      console.error('Failed to fetch dashboard reference data', error);
    } finally {
      setLoadingData(false);
    }
  }, [isAdmin, isAuthorized, token, userOperatorId, userRole]);

  const fetchSummary = useCallback(async () => {
    if (!token || !userRole || !isAuthorized) {
      setLoadingSummary(false);
      return;
    }
    if (reportingWindow === 'custom' && customRangeError) {
      setLoadingSummary(false);
      return;
    }

    setLoadingSummary(true);
    try {
      const toUtc = reportingWindow === 'custom' ? new Date(customToLocal) : new Date();
      const windowHours = reportingWindow === '24h' ? 24 : reportingWindow === '7d' ? 168 : 720;
      const fromUtc = reportingWindow === 'custom'
        ? new Date(customFromLocal)
        : new Date(toUtc.getTime() - windowHours * 60 * 60 * 1000);

      setSummary(await fetchDashboardSummaryRequest(token, {
        operatorId: selectedOperatorId,
        siteId: selectedSiteId,
        externalCompanyId: selectedExternalCompanyId,
        fromUtc: fromUtc.toISOString(),
        toUtc: toUtc.toISOString(),
      }));
    } catch (error) {
      console.error('Failed to fetch dashboard summary', error);
    } finally {
      setLoadingSummary(false);
    }
  }, [
    customFromLocal,
    customRangeError,
    customToLocal,
    isAuthorized,
    reportingWindow,
    selectedOperatorId,
    selectedExternalCompanyId,
    selectedSiteId,
    token,
    userRole,
  ]);

  const fetchZones = useCallback(async () => {
    if (!token || !userRole || !isAuthorized) {
      setLoadingZones(false);
      return;
    }
    setLoadingZones(true);
    try {
      setZones(await listGeoRegions(token, { includeInactive: true }));
    } catch (error) {
      console.error('Failed to fetch monitored zones', error);
    } finally {
      setLoadingZones(false);
    }
  }, [isAuthorized, token, userRole]);

  useEffect(() => {
    void fetchReferenceData();
  }, [fetchReferenceData]);

  useEffect(() => {
    void fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    void fetchZones();
  }, [fetchZones]);

  useLiveEvents(
    useCallback((event) => {
      if (
        event.type === 'GateActivityChanged'
        || event.type === 'AccessRequestChanged'
        || event.type === 'PresenceChanged'
        || event.type === 'DashboardRefresh'
      ) {
        void fetchSummary();
      }
    }, [fetchSummary]),
    { enabled: isAuthorized },
  );

  usePolling(() => {
    void fetchSummary();
  }, 45_000);

  const visibleZones = useMemo(() => zones.filter((region) => {
    if (selectedSiteId !== 'all' && region.siteId !== selectedSiteId) return false;
    if (selectedOperatorId !== 'all' && region.operatorId !== selectedOperatorId) return false;
    if (selectedExternalCompanyId !== 'all') {
      const visibleSiteIds = new Set(mapSiteSummaries.map((site) => site.siteId));
      return region.contractorId === selectedExternalCompanyId
        || (!!region.siteId && visibleSiteIds.has(region.siteId));
    }
    return true;
  }), [mapSiteSummaries, selectedExternalCompanyId, selectedOperatorId, selectedSiteId, zones]);

  const opsZones = useMemo<OpsZone[]>(() => visibleZones.map((region) => {
    const hasCenter = region.centerLatitude !== null
      && region.centerLatitude !== undefined
      && region.centerLongitude !== null
      && region.centerLongitude !== undefined;

    return {
      id: region.id,
      name: region.name,
      shape: region.shape,
      center: hasCenter
        ? [region.centerLatitude as number, region.centerLongitude as number]
        : null,
      radiusMeters: region.radiusMeters,
      polygon: (region.polygon ?? []).map(
        (point) => [point.latitude, point.longitude] as [number, number],
      ),
      tone: region.governanceMode === 'Disabled'
        ? 'muted'
        : region.shape === 'Polygon'
          ? 'teal'
          : 'primary',
      meta: region.siteName || region.governanceMode,
      active: region.isActive,
    };
  }), [visibleZones]);

  const mapPoints = useMemo<OpsPoint[]>(() => {
    const pointsBySite = new Map<string, OpsPoint>();
    for (const region of visibleZones) {
      if (!region.siteId || pointsBySite.has(region.siteId)) continue;
      const polygon = region.polygon ?? [];
      const position: [number, number] | null = region.centerLatitude != null && region.centerLongitude != null
        ? [region.centerLatitude, region.centerLongitude]
        : polygon.length > 0
          ? [
              polygon.reduce((sum, point) => sum + point.latitude, 0) / polygon.length,
              polygon.reduce((sum, point) => sum + point.longitude, 0) / polygon.length,
            ]
          : null;
      if (!position) continue;
      const overview = mapSiteSummaries.find((site) => site.siteId === region.siteId);
      if (!overview) continue;
      const requestCount = overview.pendingRequests + overview.approvedRequests + overview.deniedRequests;
      pointsBySite.set(region.siteId, {
        id: `site-${region.siteId}`,
        position,
        label: overview.siteName,
        meta: `${overview.registeredWorkers} workers · ${overview.projects} projects · ${overview.externalCompanies} companies · ${requestCount} requests`,
        tone: overview.pendingRequests > 0 ? 'warning' : 'success',
      });
    }
    return [...pointsBySite.values()];
  }, [mapSiteSummaries, visibleZones]);

  const hasMappableData = useMemo(
    () => mapPoints.length > 0 || opsZones.some(
      (zone) => (zone.center && zone.center.length === 2)
        || (zone.polygon && zone.polygon.length > 0),
    ),
    [mapPoints.length, opsZones],
  );

  const filteredDashboardRequests = useMemo(
    () => (summary?.accessRequests ?? []).filter(
      (request) => requestStatusFilter === 'all' || request.status === requestStatusFilter,
    ),
    [requestStatusFilter, summary?.accessRequests],
  );

  if (loading) {
    return <DashboardLoading />;
  }
  if (!isAuthorized) {
    return <UnauthorizedComponent />;
  }
  if (!currentUser) {
    return null;
  }

  const generatedAt = summary?.generatedAtUtc
    ? new Date(summary.generatedAtUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  const firstName = currentUser.name.split(/\s+/)[0] || 'there';

  return (
    <div className="dashboard-home -mx-4 -my-4 min-h-[calc(100vh-4rem)] bg-[#f4f8fa] p-0 md:-mx-6 md:-my-6 md:p-0 lg:-mx-8 lg:-my-8 lg:p-0">
      <div className="dashboard-frame mx-auto max-w-[1600px] bg-transparent p-0 shadow-none">
      <div className="dashboard-reference-topbar">
        <SidebarTrigger
          aria-label="Open navigation"
          className="h-10 w-10 rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 md:hidden"
        />
        <div className="dashboard-reference-search">
          <Search className="h-3.5 w-3.5 text-slate-400" />
          <input aria-label="Search dashboard" placeholder="Search…" />
        </div>
        <div className="flex items-center gap-3">
          <span className="dashboard-reference-status"><span className="status-dot status-dot--live" />Live</span>
          <Bell className="h-4 w-4 text-slate-400" />
          <div className="dashboard-reference-avatar">{firstName.slice(0, 2).toUpperCase()}</div>
        </div>
      </div>
      <header className="dashboard-header flex flex-col gap-5 px-1 pb-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <p className="dashboard-eyebrow text-primary">Command center · operations</p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-[26px] font-semibold tracking-[-.04em] text-slate-900">Good morning, {firstName}</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.12em] text-emerald-700">
              <Radio className="h-3 w-3" /> Live
            </span>
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            {generatedAt ? `Updated ${generatedAt}` : 'Syncing live operations'} · A focused view of the work that needs attention.
          </p>
        </div>

        <div aria-label="Dashboard filters" className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Select value={reportingWindow} onValueChange={(value) => setReportingWindow(value as ReportingWindow)}>
            <SelectTrigger aria-label="Reporting window" className="h-9 w-full rounded-lg border-slate-200 bg-white text-xs shadow-sm sm:w-[148px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24 hours</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="custom">Custom range</SelectItem>
            </SelectContent>
          </Select>

          {isAdmin ? (
            loadingData ? (
              <Skeleton className="h-10 w-full sm:w-[190px]" />
            ) : (
              <Select value={selectedOperatorId} onValueChange={setSelectedOperatorId}>
                <SelectTrigger aria-label="Operator" className="h-9 w-full rounded-lg border-slate-200 bg-white text-xs shadow-sm sm:w-[170px]">
                  <SelectValue placeholder="Operator" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All operators</SelectItem>
                  {operators.map((operator) => (
                    <SelectItem key={operator.id} value={operator.id}>{operator.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )
          ) : null}

          {loadingData ? (
            <Skeleton className="h-10 w-full sm:w-[190px]" />
          ) : (
            <Select
              value={selectedSiteId}
              onValueChange={setSelectedSiteId}
              disabled={isAdmin && selectedOperatorId === 'all'}
            >
              <SelectTrigger aria-label="Site" className="h-9 w-full rounded-lg border-slate-200 bg-white text-xs shadow-sm sm:w-[170px]">
                <SelectValue placeholder="Site" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sites</SelectItem>
                {filteredSites.map((site) => (
                  <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {loadingData ? (
            <Skeleton className="h-10 w-full sm:w-[220px]" />
          ) : (
            <Select value={selectedExternalCompanyId} onValueChange={setSelectedExternalCompanyId}>
              <SelectTrigger aria-label="External company" className="h-9 w-full rounded-lg border-slate-200 bg-white text-xs shadow-sm sm:w-[220px]">
                <SelectValue placeholder="External company" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All contractors & consultants</SelectItem>
                {externalCompanies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name} · {externalCompanyTypeLabel(company.companyType)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </header>

      {reportingWindow === 'custom' ? (
          <section aria-label="Custom reporting range" className="dashboard-panel grid gap-3 p-4 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-medium text-foreground">
            From
            <input
              type="datetime-local"
              aria-label="From date and time"
              value={customFromLocal}
              onChange={(event) => setCustomFromLocal(event.target.value)}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 font-normal"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-foreground">
            To
            <input
              type="datetime-local"
              aria-label="To date and time"
              value={customToLocal}
              onChange={(event) => setCustomToLocal(event.target.value)}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 font-normal"
            />
          </label>
          {customRangeError ? (
            <p className="text-xs text-destructive sm:col-span-2" role="alert">{customRangeError}</p>
          ) : null}
        </section>
      ) : null}

      <Tabs defaultValue="overview" className="space-y-4">
        <div className="dashboard-controlbar flex flex-wrap items-center justify-between gap-3 border-y border-slate-200/80 py-2">
          <TabsList className="h-9 w-full justify-start rounded-xl border border-slate-200 bg-white p-1 shadow-sm sm:w-auto">
            <TabsTrigger value="overview" className="gap-2 rounded-lg px-4 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Activity className="h-3.5 w-3.5" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="planning" className="gap-2 rounded-lg px-4 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Planning
            </TabsTrigger>
            <TabsTrigger value="insights" className="gap-2 rounded-lg px-4 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <MapPinned className="h-3.5 w-3.5" />
              Insights
            </TabsTrigger>
          </TabsList>
          <DashboardTools
            summary={summary}
            showAttendanceAnalytics={showAttendanceAnalytics}
            operatorId={selectedOperatorId}
            siteId={selectedSiteId}
            reportingWindow={reportingWindow}
            customFromLocal={customFromLocal}
            customToLocal={customToLocal}
            onApplyView={(view) => {
              setSelectedOperatorId(view.operatorId);
              setSelectedSiteId(view.siteId);
              setReportingWindow(view.reportingWindow);
              if (view.customFromLocal) setCustomFromLocal(view.customFromLocal);
              if (view.customToLocal) setCustomToLocal(view.customToLocal);
            }}
          />
        </div>

        <TabsContent value="overview" className="mt-0 space-y-4">
          <DashboardVisuals
            summary={summary}
            isLoading={loadingSummary}
            showAttendanceAnalytics={showAttendanceAnalytics}
          />

          <div className="grid gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
            <OperationsActionQueue summary={summary} isLoading={loadingSummary} />
            <section className="ops-panel overflow-hidden">
              <header className="flex h-14 items-center justify-between border-b border-border/70 px-5">
                <div className="flex items-center gap-2">
                  <MapPinned className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold text-foreground">Operational map</h2>
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {loadingZones ? 'Loading' : `${opsZones.length} zones`}
                </span>
              </header>
              <div className="p-4">
                {loadingZones ? (
                  <Skeleton className="h-[340px] w-full rounded-xl" />
                ) : hasMappableData ? (
                  <OpsMap zones={opsZones} points={mapPoints} className="h-[340px] w-full overflow-hidden rounded-xl" />
                ) : (
                  <div className="flex h-[340px] items-center justify-center rounded-xl border border-dashed border-border bg-muted/15">
                    <p className="text-xs text-muted-foreground">No mapped zones</p>
                  </div>
                )}
              </div>
            </section>
          </div>

          <section className="ops-panel overflow-hidden" aria-label="Access requests overview">
            <header className="flex flex-col gap-3 border-b border-border/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Access requests</h2>
                <p className="mt-1 text-xs text-muted-foreground">Pending, approved, and rejected requests in the selected scope.</p>
              </div>
              <Select value={requestStatusFilter} onValueChange={setRequestStatusFilter}>
                <SelectTrigger aria-label="Access request status" className="h-9 w-full sm:w-[170px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Denied">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="bg-muted/30 text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-medium">Request</th>
                    <th className="px-5 py-3 font-medium">Company</th>
                    <th className="px-5 py-3 font-medium">Site</th>
                    <th className="px-5 py-3 font-medium">Workers</th>
                    <th className="px-5 py-3 font-medium">Submitted</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {loadingSummary ? (
                    <tr><td className="px-5 py-6 text-muted-foreground" colSpan={6}>Loading access requests…</td></tr>
                  ) : filteredDashboardRequests.length === 0 ? (
                    <tr><td className="px-5 py-6 text-muted-foreground" colSpan={6}>No requests match this filter.</td></tr>
                  ) : filteredDashboardRequests.map((request) => (
                    <tr key={request.id} className="hover:bg-muted/20">
                      <td className="px-5 py-3 font-medium"><Link className="text-primary hover:underline" href={`/access-requests?requestId=${request.id}`}>{request.contractNumber}</Link></td>
                      <td className="px-5 py-3">{request.contractorName}</td>
                      <td className="px-5 py-3">{request.siteName}</td>
                      <td className="px-5 py-3 tabular-nums">{request.workerCount}</td>
                      <td className="px-5 py-3">{new Date(request.requestedAtUtc).toLocaleDateString()}</td>
                      <td className="px-5 py-3"><RequestStatus status={request.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {showAttendanceAnalytics ? (
            <RecentActivityTable activity={summary?.recentActivity ?? []} isLoading={loadingSummary} />
          ) : null}
        </TabsContent>

        <TabsContent value="planning" className="mt-0 space-y-4">
          {token && canScheduleReports ? (
            <ReportSchedulesPanel token={token} sites={filteredSites} />
          ) : null}
          {token && canManageRosters ? (
            <ShiftRostersPanel token={token} sites={filteredSites} />
          ) : null}
          {!canScheduleReports && !canManageRosters ? (
            <EmptyTab label="No planning tools are available for this role." />
          ) : null}
        </TabsContent>

        <TabsContent value="insights" className="mt-0 space-y-4">
          {summary?.audience.visiblePanels.includes('portfolio') ? (
            <ManagementScorecards summary={summary} />
          ) : null}
          {summary?.audience.visiblePanels.includes('adoption') ? (
            <>
              <RegistrationFunnelPanel summary={summary} />
              <InclusiveAdoptionPanel summary={summary} />
            </>
          ) : null}
          {summary?.audience.visiblePanels.includes('data-quality') ? (
            <DataQualityPanel summary={summary} />
          ) : null}
          {!summary?.audience.visiblePanels.some(
            (panel) => ['portfolio', 'adoption', 'data-quality'].includes(panel),
          ) ? (
            <EmptyTab label="No additional insights are available for this scope." />
          ) : null}
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}

function DashboardLoading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-14 w-full" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-28 w-full" />
        ))}
      </div>
      <Skeleton className="h-[420px] w-full" />
    </div>
  );
}

function EmptyTab({ label }: { label: string }) {
  return (
    <div className="ops-panel flex min-h-48 items-center justify-center p-6">
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function RequestStatus({ status }: { status: string }) {
  const label = status === 'Denied' ? 'Rejected' : status;
  const tone = status === 'Approved'
    ? 'bg-emerald-50 text-emerald-700'
    : status === 'Pending'
      ? 'bg-amber-50 text-amber-700'
      : 'bg-rose-50 text-rose-700';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${tone}`}>{label}</span>;
}

function toLocalDateTimeValue(date: Date) {
  const timezoneOffsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
}

function validateCustomRange(fromLocal: string, toLocal: string) {
  if (!fromLocal || !toLocal) return 'Choose both dates and times.';
  const from = new Date(fromLocal);
  const to = new Date(toLocal);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 'Choose valid dates and times.';
  if (from >= to) return 'The start must be earlier than the end.';
  if (to.getTime() - from.getTime() > 366 * 24 * 60 * 60 * 1000) return 'The range cannot exceed 366 days.';
  return null;
}
