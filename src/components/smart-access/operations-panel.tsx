'use client';

import { RefreshCw, Smartphone } from 'lucide-react';
import type { AccessControlDevice, DeviceSyncJob } from '@/lib/smart-access-api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { StatusBadge } from './common';

export function SmartAccessOperationsPanel({
  open,
  onOpenChange,
  devices,
  syncJobs,
  canManage,
  runningAction,
  onTestSync,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  devices: AccessControlDevice[];
  syncJobs: DeviceSyncJob[];
  canManage: boolean;
  runningAction: 'sync' | null;
  onTestSync: () => void;
}) {
  const syncDevice = devices.find((device) => device.isActive !== false);
  const mobileDevices = devices.filter((device) => device.supportsOfflineSync || device.isBatteryFree);
  const failedSyncJobs = syncJobs.filter((job) => ['Failed', 'RetryScheduled', 'Unsupported'].includes(job.status));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Operations Console</DialogTitle>
          <DialogDescription>
            Smart-lock actions, mobile-readiness, and sync pressure for the selected scope.
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[75vh] gap-3 overflow-y-auto md:grid-cols-3">
          <div className="rounded-md border border-border bg-muted/40 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Sync target</span>
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-2 text-sm text-foreground">{syncDevice?.name ?? 'No active device'}</div>
            {syncDevice && <p className="mt-1 text-xs text-muted-foreground">{syncDevice.deviceKind} / {syncDevice.serialNumber}</p>}
          </div>
          <div className="rounded-md border border-border bg-muted/40 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Mobile / offline locks</span>
              <Smartphone className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-2 text-2xl font-semibold text-foreground">{mobileDevices.length}</div>
            <p className="text-xs text-muted-foreground">Battery-free or offline-sync capable devices.</p>
          </div>
          <div className="rounded-md border border-border bg-muted/40 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Sync health</span>
              <StatusBadge value={failedSyncJobs.length ? 'Failed' : 'Succeeded'} />
            </div>
            <div className="mt-2 text-2xl font-semibold text-foreground">{failedSyncJobs.length}</div>
            <p className="text-xs text-muted-foreground">Failed, unsupported, or retry-scheduled jobs.</p>
          </div>
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={runningAction !== null}>
            Cancel
          </Button>
          {canManage && (
            <Button onClick={onTestSync} disabled={runningAction !== null || !syncDevice}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Test Sync
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
