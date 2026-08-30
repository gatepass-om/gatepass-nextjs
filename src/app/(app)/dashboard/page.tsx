'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, MapPinned } from 'lucide-react';
import { externalCompanyTypeLabel } from '@/components/compliance/compliance-model';
import {
  DashboardTools,
  type DashboardRequestStatusFilter,
  type ReportingWindow,
} from '@/components/dashboard/dashboard-tools';
import { shouldShowAttendanceAnalytics } from '@/components/dashboard/dashboard-mode';
import { createLatestRequestCoordinator, getDashboardFreshness } from '@/components/dashboard/dashboard-refresh';
import { OperationsActionQueue } from '@/components/dashboard/operations-action-queue';
import { RecentActivityTable } from '@/components/dashboard/recent-activity-table';
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

const DASHBOARD_ROLES: UserRole[] = ['Admin', 'Operator Admin', 'Manager', 'Supervisor', 'Contractor Admin', 'Security'];
const EMPTY_MAP_SITES: DashboardSummary['mapSites'] = [];

export default function DashboardPage() {
  const {
    currentUser,
    loading,
    isAuthorized,
    UnauthorizedComponent,
  } = useAuthProtection(DASHBOARD_ROLES);
  const { token } = useSession();
  const userRole = currentUser?.role;
  const userId = currentUser?.id;
  const userOperatorId = currentUser?.operatorId;
  const userContractorId = currentUser?.contractorId;
  const isAdmin = userRole === 'Admin';
  const viewerScopeKey = currentUser
    ? [currentUser.id, currentUser.role, currentUser.operatorId, currentUser.contractorId, currentUser.assignedSiteId].join(':')
    : '';
  const [sites, setSites] = useState<Site[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [externalCompanies, setExternalCompanies] = useState<Contractor[]>([]);
  const [summaryResult, setSummaryResult] = useState<{
    displayScopeKey: string;
    requestScopeKey: string;
    data: DashboardSummary;
  } | null>(null);
  const [zones, setZones] = useState<GeoRegion[]>([]);
  const [loadingZones, setLoadingZones] = useState(true);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [freshnessNowMs, setFreshnessNowMs] = useState(() => Date.now());
  const [failedSummaryScopeKey, setFailedSummaryScopeKey] = useState<string | null>(null);
  const [selectedOperatorId, setSelectedOperatorId] = useState('all');
  const [selectedSiteId, setSelectedSiteId] = useState('all');
  const [selectedExternalCompanyId, setSelectedExternalCompanyId] = useState('all');
  const [requestStatusFilter, setRequestStatusFilter] = useState<DashboardRequestStatusFilter>('all');
  const effectiveExternalCompanyId = userContractorId ?? selectedExternalCompanyId;
  const effectiveExternalCompanyName = externalCompanies
    .find((company) => company.id === effectiveExternalCompanyId)?.name
    ?? (userContractorId ? currentUser?.company ?? undefined : undefined);
  const loadedSummaryDisplayScopeRef = useRef<string | null>(null);
  const previousViewerScopeRef = useRef<string | null>(null);
  const summaryRequestCoordinatorRef = useRef<ReturnType<typeof createLatestRequestCoordinator> | null>(null);
  if (summaryRequestCoordinatorRef.current === null) {
    summaryRequestCoordinatorRef.current = createLatestRequestCoordinator();
  }
  const [reportingWindow, setReportingWindow] = useState<ReportingWindow>('24h');
  const [customFromLocal, setCustomFromLocal] = useState(
    () => toLocalDateTimeValue(new Date(Date.now() - 24 * 60 * 60 * 1000)),
  );
  const [customToLocal, setCustomToLocal] = useState(() => toLocalDateTimeValue(new Date()));
  const summaryDisplayScopeKey = [
    viewerScopeKey,
    selectedOperatorId,
    selectedSiteId,
    effectiveExternalCompanyId,
    reportingWindow,
    reportingWindow === 'custom' ? customFromLocal : '',
    reportingWindow === 'custom' ? customToLocal : '',
  ].join('|');
  const summaryRequestScopeKey = [summaryDisplayScopeKey, requestStatusFilter].join('|');
  const summary = summaryResult?.displayScopeKey === summaryDisplayScopeKey ? summaryResult.data : null;
  const mapSiteSummaries = summary?.mapSites ?? EMPTY_MAP_SITES;
  const showAttendanceAnalytics = shouldShowAttendanceAnalytics(summary?.operatingModes);
  const dashboardPanelKeys = summary?.audience.panelKeys ?? [];

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
    if (!viewerScopeKey || previousViewerScopeRef.current === viewerScopeKey) return;
    previousViewerScopeRef.current = viewerScopeKey;
    setSelectedOperatorId('all');
    setSelectedSiteId('all');
    setSelectedExternalCompanyId('all');
  }, [viewerScopeKey]);

  useEffect(() => {
    if (selectedSiteId !== 'all' && !filteredSites.some((site) => site.id === selectedSiteId)) {
      setSelectedSiteId('all');
    }
  }, [filteredSites, selectedSiteId]);

  const fetchReferenceData = useCallback(async () => {
    if (!token || !userRole || !isAuthorized) {
      setLoadingData(false);
      return;
    }

    setLoadingData(true);
    try {
      const sitesRequest = userRole === 'Operator Admin' && userOperatorId
        ? listSitesRequest(token, { operatorId: userOperatorId })
        : listSitesRequest(token);
      const operatorsRequest = isAdmin
        ? listOperatorsRequest(token).catch((error) => {
          console.warn('Operator dashboard filter is unavailable', error);
          return [];
        })
        : Promise.resolve([]);
      const companiesRequest = userContractorId
        ? Promise.resolve([])
        : listExternalCompaniesRequest(token).catch((error) => {
          console.warn('External-company dashboard filter is unavailable', error);
          return [];
        });
      const sitesData = await sitesRequest;
      const [operatorsData, companiesData] = await Promise.all([operatorsRequest, companiesRequest]);

      setSites(sitesData.map((site) => ({
        id: site.id,
        name: site.name,
        operatorId: (site as Site & { operator?: { id?: string } }).operator?.id ?? site.operatorId,
        managerIds: site.managerIds ?? [],
        requiredCertificates: site.requiredCertificates ?? [],
        requiresAccessApproval: site.requiresAccessApproval ?? false,
        usesSecurityCheckpoints: site.usesSecurityCheckpoints ?? false,
        usesSmartAccess: site.usesSmartAccess ?? false,
        maximumOccupancy: site.maximumOccupancy ?? undefined,
      })));

      setOperators(operatorsData);
      setExternalCompanies(companiesData);
    } catch (error) {
      console.error('Failed to fetch dashboard reference data', error);
    } finally {
      setLoadingData(false);
    }
  }, [isAdmin, isAuthorized, token, userContractorId, userOperatorId, userRole]);

  const fetchSummary = useCallback(async () => {
    const coordinator = summaryRequestCoordinatorRef.current!;
    if (!token || !userRole || !isAuthorized) {
      coordinator.invalidate();
      setLoadingSummary(false);
      return;
    }
    if (reportingWindow === 'custom' && customRangeError) {
      coordinator.invalidate();
      setLoadingSummary(false);
      return;
    }

    if (loadedSummaryDisplayScopeRef.current !== summaryDisplayScopeKey) {
      setLoadingSummary(true);
    }
    setFreshnessNowMs(Date.now());
    const toUtc = reportingWindow === 'custom' ? new Date(customToLocal) : new Date();
    const windowHours = reportingWindow === '24h' ? 24 : reportingWindow === '7d' ? 168 : 720;
    const fromUtc = reportingWindow === 'custom'
      ? new Date(customFromLocal)
      : new Date(toUtc.getTime() - windowHours * 60 * 60 * 1000);

    const result = await coordinator.run(() => fetchDashboardSummaryRequest(token, {
        operatorId: selectedOperatorId,
        siteId: selectedSiteId,
        externalCompanyId: effectiveExternalCompanyId,
        accessRequestStatus: requestStatusFilter === 'all' ? undefined : requestStatusFilter,
        fromUtc: fromUtc.toISOString(),
        toUtc: toUtc.toISOString(),
      }), summaryRequestScopeKey);
    if (result.status === 'stale') {
      return;
    }
    if (result.status === 'failed') {
      console.error('Failed to fetch dashboard summary', result.error);
      setFailedSummaryScopeKey(summaryRequestScopeKey);
      setLoadingSummary(false);
      return;
    }

    setSummaryResult({
      displayScopeKey: summaryDisplayScopeKey,
      requestScopeKey: summaryRequestScopeKey,
      data: result.value,
    });
    loadedSummaryDisplayScopeRef.current = summaryDisplayScopeKey;
    setFailedSummaryScopeKey(null);
    setFreshnessNowMs(Date.now());
    setLoadingSummary(false);
  }, [
    customFromLocal,
    customRangeError,
    customToLocal,
    isAuthorized,
    requestStatusFilter,
    reportingWindow,
    selectedOperatorId,
    effectiveExternalCompanyId,
    selectedSiteId,
    summaryDisplayScopeKey,
    summaryRequestScopeKey,
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

  useEffect(() => {
    const intervalId = window.setInterval(() => setFreshnessNowMs(Date.now()), 30_000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => () => summaryRequestCoordinatorRef.current?.invalidate(), []);

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

  const hasMatchingRequestList = summaryResult?.requestScopeKey === summaryRequestScopeKey;
  const requestListFailed = failedSummaryScopeKey === summaryRequestScopeKey;
  const loadingAccessRequests = !hasMatchingRequestList && !requestListFailed;
  const dashboardRequests = hasMatchingRequestList ? summaryResult.data.accessRequests : [];

  if (loading) {
    return <DashboardLoading />;
  }
  if (!isAuthorized) {
    return <UnauthorizedComponent />;
  }
  if (!currentUser) {
    return null;
  }

  const summaryFreshness = getDashboardFreshness(
    freshnessNowMs,
    summary?.generatedAtUtc,
    failedSummaryScopeKey === summaryRequestScopeKey,
  );
  const showActionQueue = dashboardPanelKeys.includes('action-queue');
  const showOperationsMap = dashboardPanelKeys.includes('operations-map');
  const showAccessRequests = dashboardPanelKeys.includes('access-requests');
  const showRecentActivity = dashboardPanelKeys.includes('recent-activity');

  const firstName = currentUser.name.split(/\s+/)[0] || 'there';

  return (
    <div className="dashboard-home -mx-4 -my-4 min-h-[calc(100vh-4rem)] bg-[#f6f6f6] p-0 md:-mx-6 md:-my-6 md:p-0 lg:-mx-8 lg:-my-8 lg:p-0">
      <div className="dashboard-frame mx-auto max-w-[1600px] bg-transparent p-0 shadow-none">
      <div className="dashboard-reference-topbar">
        <SidebarTrigger
          aria-label="Open navigation"
          className="h-10 w-10 rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 md:hidden"
        />
        <div className="flex items-center gap-3">
          {summaryFreshness.isStale ? (
            <span className="dashboard-reference-status text-amber-700">
              <span className="status-dot bg-amber-500" />
              Data may be stale
            </span>
          ) : null}
          <Link href="/notifications" aria-label="Open notifications" className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
            <Bell className="h-4 w-4" />
          </Link>
          <div className="dashboard-reference-avatar">{firstName.slice(0, 2).toUpperCase()}</div>
        </div>
      </div>
      <header className="dashboard-header px-1 pb-4">
        <h1 className="text-[26px] font-semibold tracking-[-.04em] text-slate-900">Good morning, {firstName}</h1>
      </header>

      <section aria-label="Dashboard filters" className="dashboard-controlbar flex flex-col gap-3 border-y border-slate-200/80 py-3 xl:flex-row xl:items-center xl:justify-between">
        <div className={`grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2 ${isAdmin && !userContractorId ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
          {isAdmin ? (
            loadingData ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <Select
                value={selectedOperatorId}
                onValueChange={(operatorId) => {
                  setSelectedOperatorId(operatorId);
                  setSelectedSiteId('all');
                  setSelectedExternalCompanyId('all');
                }}
              >
                <SelectTrigger aria-label="Operator" className="h-9 w-full rounded-lg border-slate-200 bg-white text-xs shadow-sm">
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
            <Skeleton className="h-9 w-full" />
          ) : (
            <Select
              value={selectedSiteId}
              onValueChange={setSelectedSiteId}
              disabled={isAdmin && selectedOperatorId === 'all'}
            >
              <SelectTrigger aria-label="Site" className="h-9 w-full rounded-lg border-slate-200 bg-white text-xs shadow-sm">
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

          {!userContractorId ? (
            loadingData ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <Select value={selectedExternalCompanyId} onValueChange={setSelectedExternalCompanyId}>
                <SelectTrigger aria-label="External company" className="h-9 w-full rounded-lg border-slate-200 bg-white text-xs shadow-sm">
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
            )
          ) : null}

          <Select value={reportingWindow} onValueChange={(value) => setReportingWindow(value as ReportingWindow)}>
            <SelectTrigger aria-label="Reporting window" className="h-9 w-full rounded-lg border-slate-200 bg-white text-xs shadow-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24 hours</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="custom">Custom range</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DashboardTools
          summary={summary}
          showAttendanceAnalytics={showAttendanceAnalytics}
          operatorId={selectedOperatorId}
          siteId={selectedSiteId}
          externalCompanyId={effectiveExternalCompanyId}
          externalCompanyName={effectiveExternalCompanyName}
          accessRequestStatus={requestStatusFilter}
          reportingWindow={reportingWindow}
          customFromLocal={customFromLocal}
          customToLocal={customToLocal}
          onApplyView={(view) => {
            setSelectedOperatorId(view.operatorId);
            setSelectedSiteId(view.siteId);
            setSelectedExternalCompanyId(userContractorId ?? view.externalCompanyId);
            setRequestStatusFilter(view.accessRequestStatus);
            setReportingWindow(view.reportingWindow);
            if (view.customFromLocal) setCustomFromLocal(view.customFromLocal);
            if (view.customToLocal) setCustomToLocal(view.customToLocal);
          }}
        />
      </section>

      {reportingWindow === 'custom' ? (
          <section aria-label="Custom reporting range" className="dashboard-panel mt-3 grid gap-3 p-4 sm:grid-cols-2">
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

      <div className="space-y-4 pt-4">
        <div className="space-y-4">
          <DashboardVisuals
            summary={summary}
            isLoading={loadingSummary}
            showAttendanceAnalytics={showAttendanceAnalytics}
          />

          {showActionQueue || showOperationsMap ? (
          <div className={`grid gap-4 ${showActionQueue && showOperationsMap ? 'xl:grid-cols-[22rem_minmax(0,1fr)]' : ''}`}>
            {showActionQueue ? <OperationsActionQueue summary={summary} isLoading={loadingSummary} /> : null}
            {showOperationsMap ? <section className="ops-panel overflow-hidden">
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
            </section> : null}
          </div>
          ) : null}

          {showAccessRequests ? <section className="ops-panel overflow-hidden" aria-label="Access requests overview">
            <header className="flex flex-col gap-3 border-b border-border/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Access requests</h2>
                <p className="mt-1 text-xs text-muted-foreground">Pending, approved, and rejected requests in the selected scope.</p>
              </div>
              <Select
                value={requestStatusFilter}
                onValueChange={(value) => setRequestStatusFilter(value as DashboardRequestStatusFilter)}
              >
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
                  {loadingAccessRequests ? (
                    <tr><td className="px-5 py-6 text-muted-foreground" colSpan={6}>Loading access requests…</td></tr>
                  ) : requestListFailed && !hasMatchingRequestList ? (
                    <tr><td className="px-5 py-6 text-amber-700" colSpan={6}>Could not refresh requests for this filter. Other dashboard data is retained.</td></tr>
                  ) : dashboardRequests.length === 0 ? (
                    <tr><td className="px-5 py-6 text-muted-foreground" colSpan={6}>No requests match this filter.</td></tr>
                  ) : dashboardRequests.map((request) => (
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
          </section> : null}

          {showRecentActivity && showAttendanceAnalytics ? (
            <RecentActivityTable activity={summary?.recentActivity ?? []} isLoading={loadingSummary} />
          ) : null}
        </div>
      </div>
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
