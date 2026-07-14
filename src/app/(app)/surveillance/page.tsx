'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Camera, FileVideo, RefreshCw, Siren, Video } from 'lucide-react';
import { useAuthProtection } from '@/hooks/use-auth-protection';
import { useSession } from '@/providers/session-provider';
import { useToast } from '@/hooks/use-toast';
import { usePolling } from '@/lib/polling';
import { useLiveEvents } from '@/hooks/use-live-events';
import { listSitesRequest } from '@/lib/api';
import type { Site } from '@/lib/types';
import {
  type EvidenceClipRequest,
  type SurveillanceCamera,
  type SurveillanceEvent,
  type SurveillanceProvider,
  createSurveillanceCamera,
  deactivateSurveillanceCamera,
  listEvidenceClips,
  listSurveillanceCameras,
  listSurveillanceEvents,
  listSurveillanceProviders,
  requestEvidenceClip,
} from '@/lib/surveillance-api';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SummaryCard } from '@/components/smart-access/common';
import { CamerasTable } from '@/components/surveillance/cameras-table';
import { EvidenceTable } from '@/components/surveillance/evidence-table';
import { SurveillanceEventsTable } from '@/components/surveillance/events-table';
import { type NewCameraInput, RegisterCameraDialog, RequestEvidenceDialog } from '@/components/surveillance/operations-panel';

type SurveillanceState = {
  providers: SurveillanceProvider[];
  cameras: SurveillanceCamera[];
  events: SurveillanceEvent[];
  clips: EvidenceClipRequest[];
};

const emptyState: SurveillanceState = { providers: [], cameras: [], events: [], clips: [] };

export default function SurveillancePage() {
  const { currentUser, loading: authLoading, isAuthorized, UnauthorizedComponent } = useAuthProtection([
    'Admin', 'Operator Admin', 'Manager',
  ]);
  const { token } = useSession();
  const { toast } = useToast();
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState('all');
  const [data, setData] = useState<SurveillanceState>(emptyState);
  const [loadingData, setLoadingData] = useState(true);
  const [busy, setBusy] = useState(false);
  const siteFilter = selectedSiteId === 'all' ? undefined : selectedSiteId;

  const fetchData = useCallback(async () => {
    if (!token || !currentUser) return;
    setLoadingData(true);
    try {
      const sitesInput = currentUser.role === 'Operator Admin' && currentUser.operatorId
        ? { operatorId: currentUser.operatorId }
        : undefined;
      const [siteRows, providers, cameras, events, clips] = await Promise.all([
        listSitesRequest(token, sitesInput),
        listSurveillanceProviders(token),
        listSurveillanceCameras(token, { siteId: siteFilter }),
        listSurveillanceEvents(token, { siteId: siteFilter }),
        listEvidenceClips(token, { siteId: siteFilter }),
      ]);
      setSites((siteRows as any[]).map((site) => ({
        id: site.id, name: site.name, operatorId: site.operator?.id ?? site.operatorId ?? '',
        managerIds: site.managerIds ?? [], requiredCertificates: site.requiredCertificates ?? [],
      })));
      setData({ providers, cameras, events, clips });
    } catch (error: any) {
      console.error('Failed to load surveillance data', error);
      toast({ variant: 'destructive', title: 'Surveillance Load Failed', description: error.message || 'Could not load surveillance data.' });
    } finally {
      setLoadingData(false);
    }
  }, [currentUser, siteFilter, toast, token]);

  useEffect(() => { void fetchData(); }, [fetchData]);
  // Live: new surveillance events, camera inventory changes, and evidence-clip status updates refresh on arrival.
  useLiveEvents(useCallback((event) => {
    if (
      event.type === 'SurveillanceEventRecorded' ||
      event.type === 'SurveillanceInventoryChanged' ||
      event.type === 'EvidenceClipRequestChanged'
    ) {
      void fetchData();
    }
  }, [fetchData]));
  usePolling(() => { void fetchData(); }, 45000);

  const canManage = currentUser?.role === 'Admin' || currentUser?.role === 'Operator Admin';
  const offlineCount = useMemo(() => data.cameras.filter((camera) => camera.status === 'Offline' || camera.status === 'Degraded').length, [data.cameras]);
  const alertCount = useMemo(() => data.events.filter((event) => event.severity === 'Critical' || event.severity === 'Warning').length, [data.events]);

  const handleCreateCamera = async (input: NewCameraInput): Promise<boolean> => {
    if (!token) return false;
    setBusy(true);
    try {
      await createSurveillanceCamera(token, input);
      toast({ title: 'Camera Registered', description: `${input.name} is available in surveillance inventory.` });
      await fetchData();
      return true;
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Camera Registration Failed', description: error.message || 'Could not register camera.' });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleDeactivate = async (camera: SurveillanceCamera) => {
    if (!token) return;
    setBusy(true);
    try {
      await deactivateSurveillanceCamera(token, camera.id);
      toast({ title: 'Camera Deactivated', description: `${camera.name} is no longer active.` });
      await fetchData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Camera Deactivation Failed', description: error.message || 'Could not deactivate camera.' });
    } finally {
      setBusy(false);
    }
  };

  const handleRequestClip = async (cameraId: string): Promise<boolean> => {
    if (!token) return false;
    setBusy(true);
    try {
      const requestedToUtc = new Date();
      const requestedFromUtc = new Date(requestedToUtc.getTime() - 10 * 60 * 1000);
      const clip = await requestEvidenceClip(token, {
        surveillanceCameraId: cameraId,
        requestedFromUtc: requestedFromUtc.toISOString(),
        requestedToUtc: requestedToUtc.toISOString(),
      });
      toast({ title: 'Evidence Requested', description: `Clip request queued with status ${clip.status}.` });
      await fetchData();
      return true;
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Evidence Request Failed', description: error.message || 'Could not request evidence.' });
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (authLoading || !currentUser) return <div>Loading...</div>;
  if (!isAuthorized) return <UnauthorizedComponent />;

  return (
    <div className="space-y-4 md:space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Surveillance And Evidence</h1>
          <p className="text-muted-foreground">VMS cameras, thermal monitoring, correlated events, and local-first evidence retrieval.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <Select value={selectedSiteId} onValueChange={setSelectedSiteId}><SelectTrigger className="w-full sm:w-[240px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Sites</SelectItem>{sites.map((site) => <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>)}</SelectContent></Select>
          <Button variant="outline" disabled={loadingData} onClick={() => void fetchData()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
          {canManage && (
            <RegisterCameraDialog providers={data.providers} sites={sites} canManage={canManage} busy={busy} onCreateCamera={(input) => handleCreateCamera(input)} />
          )}
          <RequestEvidenceDialog cameras={data.cameras} busy={busy} onRequestClip={(cameraId) => handleRequestClip(cameraId)} />
        </div>
      </header>
      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard icon={Video} label="Providers" value={data.providers.length} />
        <SummaryCard icon={Camera} label="Cameras" value={data.cameras.length} />
        <SummaryCard icon={Siren} label="Attention Needed" value={offlineCount + alertCount} />
        <SummaryCard icon={FileVideo} label="Evidence Clips" value={data.clips.length} />
      </div>
      <Tabs defaultValue="inventory">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto">
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
        </TabsList>
        <TabsContent value="inventory"><CamerasTable cameras={data.cameras} canManage={canManage} onDeactivate={(camera) => void handleDeactivate(camera)} /></TabsContent>
        <TabsContent value="events"><SurveillanceEventsTable events={data.events} /></TabsContent>
        <TabsContent value="evidence"><EvidenceTable clips={data.clips} cameras={data.cameras} /></TabsContent>
      </Tabs>
    </div>
  );
}
