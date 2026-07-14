'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  MapPinned, Radar, RefreshCw, Route, ShieldAlert, Plus, Pencil, Trash2,
  Crosshair, Circle as CircleIcon, Pentagon, Loader2,
} from 'lucide-react';
import { useAuthProtection } from '@/hooks/use-auth-protection';
import { useSession } from '@/providers/session-provider';
import { useToast } from '@/hooks/use-toast';
import { usePolling } from '@/lib/polling';
import { useLiveEvents } from '@/hooks/use-live-events';
import { listSitesRequest } from '@/lib/api';
import type { Site } from '@/lib/types';
import {
  type GeofenceViolation, type GeoRegion, type WorkZoneAssignment,
  listGeofenceViolations, listGeoRegions, listWorkZoneAssignments, validateLocation, deleteGeoRegion,
} from '@/lib/location-governance-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { OpsMap, type OpsZone } from '@/components/maps/ops-map';
import { GeofenceDialog } from '@/components/location-governance/geofence-dialog';

type LocationState = { geofences: GeoRegion[]; assignments: WorkZoneAssignment[]; violations: GeofenceViolation[] };
const emptyState: LocationState = { geofences: [], assignments: [], violations: [] };

function StatTile({ icon: Icon, label, value, helper, tone }: { icon: any; label: string; value: number; helper: string; tone: string }) {
  return (
    <div className="ops-panel p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="eyebrow">{label}</p>
          <p className="metric-value mt-1">{value}</p>
        </div>
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}><Icon className="h-4 w-4" /></span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{helper}</p>
    </div>
  );
}

const SHAPE_ICON: Record<string, any> = { Circle: CircleIcon, Polygon: Pentagon };

export default function LocationGovernancePage() {
  const { currentUser, loading: authLoading, isAuthorized, UnauthorizedComponent } = useAuthProtection([
    'Admin', 'Operator Admin', 'Manager', 'Contractor Admin', 'Supervisor',
  ]);
  const { token } = useSession();
  const { toast } = useToast();
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState('all');
  const [data, setData] = useState<LocationState>(emptyState);
  const [loadingData, setLoadingData] = useState(true);
  const [testLatitude, setTestLatitude] = useState('18.1376');
  const [testLongitude, setTestLongitude] = useState('55.1826');
  const [selectedRegionId, setSelectedRegionId] = useState<string>('');
  const [validationResult, setValidationResult] = useState<{ result: string; reason?: string | null } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRegion, setEditingRegion] = useState<GeoRegion | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GeoRegion | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [validateOpen, setValidateOpen] = useState(false);

  const canManage = currentUser?.role === 'Admin' || currentUser?.role === 'Operator Admin';
  const siteFilter = selectedSiteId === 'all' ? undefined : selectedSiteId;

  const fetchData = useCallback(async () => {
    if (!token || !currentUser) return;
    try {
      const sitesInput = currentUser.role === 'Operator Admin' && currentUser.operatorId ? { operatorId: currentUser.operatorId } : undefined;
      const [sitesData, geofences, assignments, violations] = await Promise.all([
        listSitesRequest(token, sitesInput),
        listGeoRegions(token, { siteId: siteFilter }),
        listWorkZoneAssignments(token),
        listGeofenceViolations(token, { openOnly: true }),
      ]);
      setSites((sitesData as any[]).map((s) => ({ id: s.id, name: s.name, operatorId: s.operator?.id ?? s.operatorId ?? '', managerIds: s.managerIds ?? [], requiredCertificates: s.requiredCertificates ?? [] })));
      setData({ geofences, assignments, violations });
      setSelectedRegionId((prev) => prev || geofences[0]?.id || '');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Load failed', description: error.message || 'Could not load geofence data.' });
    } finally {
      setLoadingData(false);
    }
  }, [currentUser, siteFilter, toast, token]);

  useEffect(() => { void fetchData(); }, [fetchData]);
  // Live: geofence violations, work-session safety changes, and geofence edits refresh on arrival. (Region-less
  // violations only reach admins live — see /events/me scope filtering — so polling remains the safety net.)
  useLiveEvents(useCallback((event) => {
    if (
      event.type === 'GeofenceViolationRecorded' ||
      event.type === 'WorkSessionSafetyChanged' ||
      event.type === 'LocationGovernanceChanged'
    ) {
      void fetchData();
    }
  }, [fetchData]));
  usePolling(() => { void fetchData(); }, 45000);

  const violationRegionIds = useMemo(() => new Set(data.violations.map((v) => v.geoRegionId).filter(Boolean) as string[]), [data.violations]);

  const zones: OpsZone[] = useMemo(() => data.geofences.map((r) => {
    const hasViolation = violationRegionIds.has(r.id);
    return {
      id: r.id, name: r.name, shape: r.shape,
      center: r.centerLatitude != null && r.centerLongitude != null ? [r.centerLatitude, r.centerLongitude] : null,
      radiusMeters: r.radiusMeters ?? undefined,
      polygon: (r.polygon ?? []).map((p) => [p.latitude, p.longitude] as [number, number]),
      tone: hasViolation ? 'danger' : r.governanceMode === 'Disabled' ? 'muted' : r.shape === 'Polygon' ? 'teal' : 'primary',
      meta: `${r.governanceMode}${r.siteName ? ` · ${r.siteName}` : ''}`,
      active: r.isActive,
    } as OpsZone;
  }), [data.geofences, violationRegionIds]);

  const filteredAssignments = useMemo(() => {
    const ids = new Set(data.geofences.map((r) => r.id));
    return data.assignments.filter((a) => ids.has(a.geoRegionId));
  }, [data.assignments, data.geofences]);

  const selectedRegion = data.geofences.find((r) => r.id === selectedRegionId);

  const handleValidate = async () => {
    if (!token || !selectedRegion) return;
    const lat = Number(testLatitude), lng = Number(testLongitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      toast({ variant: 'destructive', title: 'Invalid coordinate', description: 'Latitude and longitude must be numbers.' });
      return;
    }
    try {
      const r = await validateLocation(token, { geoRegionId: selectedRegion.id, siteId: selectedRegion.siteId, latitude: lat, longitude: lng, accuracyMeters: 15, source: 'ManualAdminCheck' });
      setValidationResult({ result: r.result, reason: r.reason });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Validation failed', description: error.message || 'Could not validate.' });
    }
  };

  const handleDelete = async () => {
    if (!token || !deleteTarget) return;
    setDeleting(true);
    try {
      await deleteGeoRegion(token, deleteTarget.id);
      toast({ title: 'Geofence deleted', description: `${deleteTarget.name} removed.` });
      setDeleteTarget(null);
      void fetchData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Delete failed', description: error.message || 'Could not delete geofence.' });
    } finally {
      setDeleting(false);
    }
  };

  if (authLoading || !currentUser) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!isAuthorized) return <UnauthorizedComponent />;

  const resultTone = validationResult?.result === 'Inside' ? 'text-success' : validationResult?.result === 'Outside' ? 'text-destructive' : 'text-warning';

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Location governance</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Geofencing &amp; Work Zones</h1>
          <p className="text-sm text-muted-foreground">Monitored work regions, subcontractor scopes, and live compliance exceptions.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Filter by site" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sites</SelectItem>
              {sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => void fetchData()} disabled={loadingData}><RefreshCw className={`h-4 w-4 ${loadingData ? 'animate-spin' : ''}`} /></Button>
          <Button variant="outline" onClick={() => setValidateOpen(true)}><Crosshair className="mr-1.5 h-4 w-4" /> Check location</Button>
          {canManage && (
            <Button onClick={() => { setEditingRegion(null); setDialogOpen(true); }}>
              <Plus className="mr-1.5 h-4 w-4" /> New geofence
            </Button>
          )}
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={MapPinned} label="Geofences" value={data.geofences.length} helper="Defined work regions" tone="bg-primary/15 text-primary" />
        <StatTile icon={Route} label="Assignments" value={filteredAssignments.length} helper="Worker / contractor scopes" tone="bg-accent/15 text-accent" />
        <StatTile icon={ShieldAlert} label="Open Violations" value={data.violations.length} helper="Needs review" tone="bg-destructive/15 text-destructive" />
        <StatTile icon={Radar} label="Active Regions" value={data.geofences.filter((r) => r.isActive).length} helper="Currently enforced" tone="bg-success/15 text-success" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        {/* Map */}
        <div className="ops-panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="flex items-center gap-2">
              <Radar className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Monitored Zones</h2>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" />Enforced</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-accent" />Region</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-destructive" />Violation</span>
            </div>
          </div>
          <div className="h-[600px] w-full">
            {zones.length ? (
              <OpsMap className="h-full w-full" zones={zones} />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                <MapPinned className="h-6 w-6" />
                <p className="text-sm">No geofences with coordinates yet.</p>
                {canManage && <Button size="sm" variant="outline" onClick={() => { setEditingRegion(null); setDialogOpen(true); }}><Plus className="mr-1.5 h-4 w-4" />Create one</Button>}
              </div>
            )}
          </div>
        </div>

        {/* Registry + tester */}
        <div className="space-y-4">
          <div className="ops-panel">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="text-sm font-semibold">Zone Registry</h2>
              <span className="text-xs text-muted-foreground">{data.geofences.length} total</span>
            </div>
            <div className="max-h-[538px] divide-y divide-border/70 overflow-y-auto">
              {data.geofences.map((r) => {
                const Icon = SHAPE_ICON[r.shape] ?? CircleIcon;
                const active = r.id === selectedRegionId;
                return (
                  <div key={r.id} className={`flex items-center gap-3 px-5 py-3 transition-colors ${active ? 'bg-primary/5' : 'hover:bg-muted/40'}`} onClick={() => setSelectedRegionId(r.id)}>
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${violationRegionIds.has(r.id) ? 'bg-destructive/15 text-destructive' : 'bg-muted text-muted-foreground'}`}><Icon className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{r.governanceMode}{r.siteName ? ` · ${r.siteName}` : ''}</p>
                    </div>
                    <span className={`status-dot ${r.isActive ? 'bg-success' : 'bg-muted-foreground'}`} title={r.isActive ? 'Active' : 'Inactive'} />
                    {canManage && (
                      <div className="flex shrink-0 items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setEditingRegion(r); setDialogOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteTarget(r); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    )}
                  </div>
                );
              })}
              {!data.geofences.length && <div className="px-5 py-8 text-center text-sm text-muted-foreground">No geofences defined.</div>}
            </div>
          </div>
        </div>
      </div>

      {/* Assignments + Violations */}
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="ops-panel">
          <div className="flex items-center justify-between border-b border-border px-5 py-3"><h2 className="text-sm font-semibold">Work-Zone Assignments</h2><span className="text-xs text-muted-foreground">{filteredAssignments.length}</span></div>
          <div className="max-h-[280px] divide-y divide-border/70 overflow-y-auto">
            {filteredAssignments.map((a) => (
              <div key={a.id} className="flex items-center justify-between px-5 py-3">
                <div className="min-w-0"><p className="truncate text-sm font-medium">{a.userName || a.contractorName || 'Unassigned'}</p><p className="truncate text-xs text-muted-foreground">{a.geoRegionName} · {a.governanceMode}</p></div>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs ${a.isActive ? 'border-success/30 bg-success/10 text-success' : 'border-border bg-muted/40 text-muted-foreground'}`}>{a.isActive ? 'Active' : 'Inactive'}</span>
              </div>
            ))}
            {!filteredAssignments.length && <div className="px-5 py-8 text-center text-sm text-muted-foreground">No assignments.</div>}
          </div>
        </div>

        <div className="ops-panel">
          <div className="flex items-center justify-between border-b border-border px-5 py-3"><h2 className="flex items-center gap-2 text-sm font-semibold"><ShieldAlert className="h-4 w-4 text-destructive" />Open Violations</h2><span className="text-xs text-muted-foreground">{data.violations.length}</span></div>
          <div className="max-h-[280px] divide-y divide-border/70 overflow-y-auto">
            {data.violations.map((v) => (
              <div key={v.id} className="flex items-start gap-3 px-5 py-3">
                <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-destructive/15 text-destructive"><ShieldAlert className="h-3.5 w-3.5" /></span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{v.userName}</p><p className="text-xs text-muted-foreground">{v.description}</p></div>
                <span className="shrink-0 rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-xs text-destructive">{v.severity}</span>
              </div>
            ))}
            {!data.violations.length && <div className="px-5 py-8 text-center text-sm text-muted-foreground">No open violations.</div>}
          </div>
        </div>
      </div>

      <Dialog open={validateOpen} onOpenChange={setValidateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Crosshair className="h-4 w-4 text-accent" />Location Check</DialogTitle>
            <DialogDescription>Validate a coordinate against a geofence boundary.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={selectedRegionId} onValueChange={setSelectedRegionId}>
              <SelectTrigger><SelectValue placeholder="Select region" /></SelectTrigger>
              <SelectContent>{data.geofences.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className="text-xs">Latitude</Label><Input value={testLatitude} onChange={(e) => setTestLatitude(e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs">Longitude</Label><Input value={testLongitude} onChange={(e) => setTestLongitude(e.target.value)} /></div>
            </div>
            {validationResult && (
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Result: </span>
                <span className={`font-semibold ${resultTone}`}>{validationResult.result}</span>
                {validationResult.reason && <p className="mt-0.5 text-xs text-muted-foreground">{validationResult.reason}</p>}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setValidateOpen(false)}>Close</Button>
            <Button onClick={() => void handleValidate()} disabled={!selectedRegion}>Validate point</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <GeofenceDialog open={dialogOpen} onOpenChange={setDialogOpen} token={token} region={editingRegion} sites={sites} contextZones={zones} onSaved={fetchData} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete geofence?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes &ldquo;{deleteTarget?.name}&rdquo; and its monitoring scope. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void handleDelete(); }} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
