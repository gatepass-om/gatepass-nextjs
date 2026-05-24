'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, MapPinned, Radar, RefreshCw, Route, ShieldAlert, type LucideIcon } from 'lucide-react';
import { useAuthProtection } from '@/hooks/use-auth-protection';
import { useSession } from '@/providers/session-provider';
import { useToast } from '@/hooks/use-toast';
import { usePolling } from '@/lib/polling';
import { listSitesRequest } from '@/lib/api';
import type { Site } from '@/lib/types';
import {
  type GeofenceViolation,
  type GeoRegion,
  type WorkZoneAssignment,
  listGeofenceViolations,
  listGeoRegions,
  listWorkZoneAssignments,
  validateLocation,
} from '@/lib/location-governance-api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type LocationState = {
  geofences: GeoRegion[];
  assignments: WorkZoneAssignment[];
  violations: GeofenceViolation[];
};

const emptyState: LocationState = {
  geofences: [],
  assignments: [],
  violations: [],
};

function StatusBadge({ value }: { value?: string | null }) {
  const normalized = value ?? 'Unknown';
  const variant = ['Active', 'Inside', 'Closed', 'Low'].includes(normalized)
    ? 'default'
    : ['Outside', 'Open', 'Critical', 'High'].includes(normalized)
      ? 'destructive'
      : 'secondary';

  return <Badge variant={variant}>{normalized}</Badge>;
}

function SummaryCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function formatWindow(from: string, to?: string | null) {
  const start = new Date(from).toLocaleString();
  const end = to ? new Date(to).toLocaleString() : 'Open-ended';
  return `${start} - ${end}`;
}

export default function LocationGovernancePage() {
  const { firestoreUser, loading: authLoading, isAuthorized, UnauthorizedComponent } = useAuthProtection([
    'Admin',
    'Operator Admin',
    'Manager',
    'Security',
    'Contractor Admin',
    'Supervisor',
  ]);
  const { token } = useSession();
  const { toast } = useToast();
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState('all');
  const [data, setData] = useState<LocationState>(emptyState);
  const [loadingData, setLoadingData] = useState(true);
  const [testLatitude, setTestLatitude] = useState('23.5882');
  const [testLongitude, setTestLongitude] = useState('58.3829');
  const [selectedRegionId, setSelectedRegionId] = useState<string>('');
  const [validationResult, setValidationResult] = useState<string | null>(null);

  const siteFilter = selectedSiteId === 'all' ? undefined : selectedSiteId;

  const fetchData = useCallback(async () => {
    if (!token || !firestoreUser) return;
    setLoadingData(true);

    try {
      const sitesInput = firestoreUser.role === 'Operator Admin' && firestoreUser.operatorId
        ? { operatorId: firestoreUser.operatorId }
        : undefined;
      const [sitesData, geofences, assignments, violations] = await Promise.all([
        listSitesRequest(token, sitesInput),
        listGeoRegions(token, { siteId: siteFilter }),
        listWorkZoneAssignments(token),
        listGeofenceViolations(token, { openOnly: true }),
      ]);

      setSites((sitesData as any[]).map((site) => ({
        id: site.id,
        name: site.name,
        operatorId: site.operator?.id ?? site.operatorId ?? '',
        managerIds: site.managerIds ?? [],
        requiredCertificates: site.requiredCertificates ?? [],
      })));
      setData({
        geofences,
        assignments,
        violations,
      });
      if (!selectedRegionId && geofences[0]) {
        setSelectedRegionId(geofences[0].id);
      }
    } catch (error: any) {
      console.error('Failed to load location governance data', error);
      toast({
        variant: 'destructive',
        title: 'Location Governance Load Failed',
        description: error.message || 'Could not load geofence data.',
      });
    } finally {
      setLoadingData(false);
    }
  }, [firestoreUser, selectedRegionId, siteFilter, toast, token]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  usePolling(() => {
    void fetchData();
  }, 20000);

  const filteredAssignments = useMemo(() => {
    const visibleRegionIds = new Set(data.geofences.map((region) => region.id));
    return data.assignments.filter((assignment) => visibleRegionIds.has(assignment.geoRegionId));
  }, [data.assignments, data.geofences]);

  const selectedRegion = data.geofences.find((region) => region.id === selectedRegionId);

  const handleValidate = async () => {
    if (!token || !selectedRegion) return;
    const latitude = Number(testLatitude);
    const longitude = Number(testLongitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      toast({ variant: 'destructive', title: 'Invalid Coordinate', description: 'Latitude and longitude must be valid numbers.' });
      return;
    }

    try {
      const result = await validateLocation(token, {
        geoRegionId: selectedRegion.id,
        siteId: selectedRegion.siteId,
        latitude,
        longitude,
        accuracyMeters: 15,
        source: 'ManualAdminCheck',
      });
      setValidationResult(`${result.result}${result.reason ? `: ${result.reason}` : ''}`);
      toast({ title: 'Location Validated', description: `${selectedRegion.name}: ${result.result}` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Validation Failed', description: error.message || 'Could not validate location.' });
    }
  };

  if (authLoading || !firestoreUser) return <div>Loading...</div>;
  if (!isAuthorized) return <UnauthorizedComponent />;

  return (
    <div className="space-y-4 md:space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Location Governance</h1>
          <p className="text-muted-foreground">Geofences, subcontractor work-zone assignments, and active compliance exceptions.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
            <SelectTrigger className="w-full sm:w-[240px]">
              <SelectValue placeholder="Filter by site" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sites</SelectItem>
              {sites.map((site) => (
                <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => void fetchData()} disabled={loadingData}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard icon={MapPinned} label="Geofences" value={data.geofences.length} />
        <SummaryCard icon={Route} label="Assignments" value={filteredAssignments.length} />
        <SummaryCard icon={ShieldAlert} label="Open Violations" value={data.violations.length} />
        <SummaryCard icon={Radar} label="Active Regions" value={data.geofences.filter((region) => region.isActive).length} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <CardHeader>
            <CardTitle>Geofence Registry</CardTitle>
            <CardDescription>Operational regions used for access validation and subcontractor work-scope monitoring.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingData ? <Skeleton className="h-56 w-full" /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Shape</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.geofences.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No geofences found.</TableCell>
                    </TableRow>
                  ) : data.geofences.map((region) => (
                    <TableRow key={region.id}>
                      <TableCell className="font-medium">{region.name}</TableCell>
                      <TableCell>{region.siteName ?? region.contractorName ?? region.operatorName ?? 'Platform'}</TableCell>
                      <TableCell>
                        {region.shape === 'Circle'
                          ? `Circle (${region.radiusMeters ?? 0}m)`
                          : `Polygon (${region.polygon.length} points)`}
                      </TableCell>
                      <TableCell>{region.governanceMode}</TableCell>
                      <TableCell><StatusBadge value={region.isActive ? 'Active' : 'Inactive'} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Point Validation</CardTitle>
            <CardDescription>Manual check for mobile-app point-of-action validation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Geofence</Label>
              <Select value={selectedRegionId} onValueChange={setSelectedRegionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select geofence" />
                </SelectTrigger>
                <SelectContent>
                  {data.geofences.map((region) => (
                    <SelectItem key={region.id} value={region.id}>{region.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Latitude</Label>
                <Input value={testLatitude} onChange={(event) => setTestLatitude(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Longitude</Label>
                <Input value={testLongitude} onChange={(event) => setTestLongitude(event.target.value)} />
              </div>
            </div>
            <Button className="w-full" onClick={() => void handleValidate()} disabled={!selectedRegionId}>
              Validate Point
            </Button>
            {validationResult && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                Result: <span className="font-medium">{validationResult}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Work-Zone Assignments</CardTitle>
            <CardDescription>Who is allowed to work inside each monitored region.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingData ? <Skeleton className="h-48 w-full" /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Region</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Window</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssignments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No assignments found.</TableCell>
                    </TableRow>
                  ) : filteredAssignments.map((assignment) => (
                    <TableRow key={assignment.id}>
                      <TableCell className="font-medium">{assignment.geoRegionName}</TableCell>
                      <TableCell>{assignment.userName ?? assignment.contractorName ?? 'Unassigned'}</TableCell>
                      <TableCell className="text-xs">{formatWindow(assignment.validFromUtc, assignment.validToUtc)}</TableCell>
                      <TableCell><StatusBadge value={assignment.isActive ? 'Active' : 'Inactive'} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Open Violations
            </CardTitle>
            <CardDescription>Compliance exceptions from mobile work-session pings.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingData ? <Skeleton className="h-48 w-full" /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Worker</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Last Seen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.violations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No open violations.</TableCell>
                    </TableRow>
                  ) : data.violations.map((violation) => (
                    <TableRow key={violation.id}>
                      <TableCell className="font-medium">{violation.userName}</TableCell>
                      <TableCell>{violation.geoRegionName ?? 'Unknown region'}</TableCell>
                      <TableCell><StatusBadge value={violation.severity} /></TableCell>
                      <TableCell className="text-xs">{new Date(violation.lastDetectedAtUtc).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
