'use client';

import type { SurveillanceCamera } from '@/lib/surveillance-api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyRow } from '@/components/smart-access/common';

// SurveillanceCameraKind: 1=Fixed, 2=PTZ, 3=Thermal, 4=Multi-Sensor, 5=Other
const CAMERA_KIND_LABELS: Record<string, string> = {
  '1': 'Fixed',
  '2': 'PTZ',
  '3': 'Thermal',
  '4': 'Multi-Sensor',
  '5': 'Other',
  fixed: 'Fixed',
  ptz: 'PTZ',
  thermal: 'Thermal',
  multisensor: 'Multi-Sensor',
  'multi-sensor': 'Multi-Sensor',
  other: 'Other',
};

// SurveillanceCameraStatus: 1=Unknown, 2=Online, 3=Offline, 4=Degraded, 5=Maintenance Required
const CAMERA_STATUS_LABELS: Record<string, string> = {
  '1': 'Unknown',
  '2': 'Online',
  '3': 'Offline',
  '4': 'Degraded',
  '5': 'Maintenance Required',
  unknown: 'Unknown',
  online: 'Online',
  offline: 'Offline',
  degraded: 'Degraded',
  maintenancerequired: 'Maintenance Required',
  'maintenance required': 'Maintenance Required',
  maintenance: 'Maintenance Required',
};

function normalizeKey(value: string | number | null | undefined): string {
  return String(value ?? '').trim().toLowerCase();
}

function cameraKindLabel(value: string | number | null | undefined): string {
  const key = normalizeKey(value);
  return CAMERA_KIND_LABELS[key] ?? (key ? String(value) : '-');
}

function cameraStatusLabel(value: string | number | null | undefined): string {
  const key = normalizeKey(value);
  return CAMERA_STATUS_LABELS[key] ?? (key ? String(value) : 'Unknown');
}

type StatusTone = 'success' | 'destructive' | 'warning' | 'muted';

function statusTone(label: string): StatusTone {
  switch (label) {
    case 'Online':
      return 'success';
    case 'Offline':
      return 'destructive';
    case 'Degraded':
    case 'Maintenance Required':
      return 'warning';
    default:
      return 'muted';
  }
}

const TONE_CLASSES: Record<StatusTone, string> = {
  success: 'border-success/30 bg-success/15 text-success',
  destructive: 'border-destructive/30 bg-destructive/15 text-destructive',
  warning: 'border-warning/30 bg-warning/15 text-warning',
  muted: 'border-border bg-muted/60 text-muted-foreground',
};

function CameraStatusPill({ value }: { value: string | number | null | undefined }) {
  const label = cameraStatusLabel(value);
  const tone = statusTone(label);
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${TONE_CLASSES[tone]}`}>
      {label}
    </span>
  );
}

export function CamerasTable({ cameras, canManage, onDeactivate }: {
  cameras: SurveillanceCamera[];
  canManage: boolean;
  onDeactivate: (camera: SurveillanceCamera) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Camera Inventory</CardTitle>
        <CardDescription>Site-scoped camera, thermal sensor, and VMS inventory.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Camera</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Capabilities</TableHead>
              <TableHead>Last Seen</TableHead>
              {canManage && <TableHead className="text-right">Action</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {cameras.length === 0 ? <EmptyRow colSpan={canManage ? 6 : 5} label="No surveillance cameras found." /> : cameras.map((camera) => (
              <TableRow key={camera.id}>
                <TableCell>
                  <div className="font-medium">{camera.name}</div>
                  <div className="text-xs text-muted-foreground">{camera.model} / {camera.serialNumber}</div>
                </TableCell>
                <TableCell>{cameraKindLabel(camera.cameraKind)}</TableCell>
                <TableCell><CameraStatusPill value={camera.status} /></TableCell>
                <TableCell className="space-x-1">
                  {camera.supportsMotionDetection && <Badge variant="outline">Motion</Badge>}
                  {camera.supportsIntrusionDetection && <Badge variant="outline">Intrusion</Badge>}
                  {camera.supportsThermalMonitoring && <Badge variant="outline">Thermal</Badge>}
                </TableCell>
                <TableCell>{camera.lastSeenAtUtc ? new Date(camera.lastSeenAtUtc).toLocaleString() : '-'}</TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" disabled={!camera.isActive} onClick={() => onDeactivate(camera)}>
                      {camera.isActive ? 'Deactivate' : 'Inactive'}
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
