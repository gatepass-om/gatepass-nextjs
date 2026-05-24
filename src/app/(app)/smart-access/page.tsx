'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RadioTower, RefreshCw, ShieldCheck, Wrench } from 'lucide-react';
import { useAuthProtection } from '@/hooks/use-auth-protection';
import { useSession } from '@/providers/session-provider';
import { useToast } from '@/hooks/use-toast';
import { usePolling } from '@/lib/polling';
import { listSitesRequest } from '@/lib/api';
import type { Site } from '@/lib/types';
import {
  type AccessControlDevice,
  type AccessPolicyMapping,
  type AccessZone,
  type DeviceAccessAssignment,
  type DeviceCommand,
  type DeviceEvent,
  type DeviceSyncJob,
  type PhysicalAccessPoint,
  type PhysicalAsset,
  type SmartAccessProvider,
  listSmartAccessAssets,
  listSmartAccessAssignments,
  listSmartAccessCommands,
  listSmartAccessDevices,
  listSmartAccessEvents,
  listSmartAccessPoints,
  listSmartAccessPolicyMappings,
  listSmartAccessProviders,
  listSmartAccessSyncJobs,
  listSmartAccessZones,
  retrySmartAccessSyncJob,
} from '@/lib/smart-access-api';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SummaryCard } from '@/components/smart-access/common';
import { InventoryTab } from '@/components/smart-access/inventory-tab';
import { ProvisioningTab } from '@/components/smart-access/provisioning-tab';
import { EventsTable } from '@/components/smart-access/events-table';
import { CommandsTable } from '@/components/smart-access/commands-table';

type SmartAccessState = {
  providers: SmartAccessProvider[];
  assets: PhysicalAsset[];
  zones: AccessZone[];
  accessPoints: PhysicalAccessPoint[];
  devices: AccessControlDevice[];
  mappings: AccessPolicyMapping[];
  assignments: DeviceAccessAssignment[];
  syncJobs: DeviceSyncJob[];
  events: DeviceEvent[];
  commands: DeviceCommand[];
};

const emptyState: SmartAccessState = {
  providers: [],
  assets: [],
  zones: [],
  accessPoints: [],
  devices: [],
  mappings: [],
  assignments: [],
  syncJobs: [],
  events: [],
  commands: [],
};

export default function SmartAccessPage() {
  const { firestoreUser, loading: authLoading, isAuthorized, UnauthorizedComponent } = useAuthProtection([
    'Admin',
    'Operator Admin',
    'Manager',
    'Security',
  ]);
  const { token } = useSession();
  const { toast } = useToast();
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState('all');
  const [data, setData] = useState<SmartAccessState>(emptyState);
  const [loadingData, setLoadingData] = useState(true);
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);

  const siteFilter = selectedSiteId === 'all' ? undefined : selectedSiteId;

  const fetchData = useCallback(async () => {
    if (!token || !firestoreUser) return;
    setLoadingData(true);

    try {
      const sitesInput = firestoreUser.role === 'Operator Admin' && firestoreUser.operatorId
        ? { operatorId: firestoreUser.operatorId }
        : undefined;
      const listInput = siteFilter ? { siteId: siteFilter } : undefined;

      const [sitesData, providers, assets, zones, accessPoints, devices, mappings, assignments, syncJobs, events, commands] =
        await Promise.all([
          listSitesRequest(token, sitesInput),
          listSmartAccessProviders(token),
          listSmartAccessAssets(token, listInput),
          listSmartAccessZones(token, listInput),
          listSmartAccessPoints(token, listInput),
          listSmartAccessDevices(token, listInput),
          listSmartAccessPolicyMappings(token, listInput),
          listSmartAccessAssignments(token, listInput),
          listSmartAccessSyncJobs(token, listInput),
          listSmartAccessEvents(token, listInput),
          listSmartAccessCommands(token, listInput),
        ]);

      setSites((sitesData as any[]).map((site) => ({
        id: site.id,
        name: site.name,
        operatorId: site.operator?.id ?? site.operatorId ?? '',
        managerIds: site.managerIds ?? [],
        requiredCertificates: site.requiredCertificates ?? [],
      })));
      setData({ providers, assets, zones, accessPoints, devices, mappings, assignments, syncJobs, events, commands });
    } catch (error: any) {
      console.error('Failed to load smart access data', error);
      toast({
        variant: 'destructive',
        title: 'Smart Access Load Failed',
        description: error.message || 'Could not load smart access data.',
      });
    } finally {
      setLoadingData(false);
    }
  }, [firestoreUser, siteFilter, toast, token]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  usePolling(() => {
    void fetchData();
  }, 15000);

  const selectedSiteName = useMemo(() => {
    if (selectedSiteId === 'all') return 'All sites';
    return sites.find((site) => site.id === selectedSiteId)?.name ?? 'Selected site';
  }, [selectedSiteId, sites]);

  const handleRetry = async (jobId: string) => {
    if (!token) return;
    setRetryingJobId(jobId);
    try {
      await retrySmartAccessSyncJob(token, jobId);
      toast({ title: 'Sync Retry Queued', description: 'The backend created a retry for this sync job.' });
      void fetchData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Retry Failed', description: error.message || 'Could not retry sync job.' });
    } finally {
      setRetryingJobId(null);
    }
  };

  if (authLoading || !firestoreUser) return <div>Loading...</div>;
  if (!isAuthorized) return <UnauthorizedComponent />;

  return (
    <div className="space-y-4 md:space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Smart Access</h1>
          <p className="text-muted-foreground">Physical access providers, devices, assignments, sync jobs, and device events.</p>
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
        <SummaryCard icon={RadioTower} label="Providers" value={data.providers.length} />
        <SummaryCard icon={ShieldCheck} label="Devices" value={data.devices.length} />
        <SummaryCard icon={Wrench} label="Assignments" value={data.assignments.length} />
        <SummaryCard icon={RefreshCw} label="Sync Jobs" value={data.syncJobs.length} />
      </div>

      <Tabs defaultValue="inventory">
        <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:grid-cols-4">
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="provisioning">Provisioning</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="commands">Commands</TabsTrigger>
        </TabsList>
        <TabsContent value="inventory">
          <InventoryTab devices={data.devices} loading={loadingData} selectedSiteName={selectedSiteName} />
        </TabsContent>
        <TabsContent value="provisioning">
          <ProvisioningTab
            assignments={data.assignments}
            syncJobs={data.syncJobs}
            retryingJobId={retryingJobId}
            onRetry={(jobId) => void handleRetry(jobId)}
          />
        </TabsContent>
        <TabsContent value="events">
          <EventsTable events={data.events} />
        </TabsContent>
        <TabsContent value="commands">
          <CommandsTable commands={data.commands} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
