'use client';

import type { AccessControlDevice } from '@/lib/smart-access-api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyRow, StatusBadge } from './common';
import { RefreshCw } from 'lucide-react';

export function InventoryTab({
  devices,
  loading,
  selectedSiteName,
  canTestSync,
  runningSync,
  onTestSync,
}: {
  devices: AccessControlDevice[];
  loading: boolean;
  selectedSiteName: string;
  canTestSync?: boolean;
  runningSync?: boolean;
  onTestSync?: (device: AccessControlDevice) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Devices</CardTitle>
        <CardDescription>{selectedSiteName} access-control devices and provider capabilities.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-40 w-full" /> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Serial</TableHead>
                <TableHead>Connectivity</TableHead>
                <TableHead>Capabilities</TableHead>
                {canTestSync && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {devices.length === 0 ? <EmptyRow colSpan={canTestSync ? 6 : 5} label="No smart access devices found." /> : devices.map((device) => (
                <TableRow key={device.id}>
                  <TableCell className="font-medium">{device.name}</TableCell>
                  <TableCell>{device.deviceKind}</TableCell>
                  <TableCell>{device.serialNumber}</TableCell>
                  <TableCell><StatusBadge value={device.connectivityStatus} /></TableCell>
                  <TableCell className="space-x-1">
                    {device.supportsRemoteCommands && <Badge variant="outline">Commands</Badge>}
                    {device.supportsStatusPolling && <Badge variant="outline">Polling</Badge>}
                    {device.supportsOfflineSync && <Badge variant="outline">Offline Sync</Badge>}
                  </TableCell>
                  {canTestSync && (
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onTestSync?.(device)}
                        disabled={runningSync || device.isActive === false}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Test sync
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
