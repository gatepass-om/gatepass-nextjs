'use client';

import type { EvidenceClipRequest, SurveillanceCamera } from '@/lib/surveillance-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyRow, StatusBadge } from '@/components/smart-access/common';

export function EvidenceTable({ clips, cameras }: { clips: EvidenceClipRequest[]; cameras: SurveillanceCamera[] }) {
  const names = new Map(cameras.map((camera) => [camera.id, camera.name]));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Evidence Clip Requests</CardTitle>
        <CardDescription>Local-first VMS footage retrieval status and evidence references.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Requested</TableHead>
              <TableHead>Camera</TableHead>
              <TableHead>Window</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Attempts</TableHead>
              <TableHead>Reference</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clips.length === 0 ? <EmptyRow colSpan={6} label="No evidence clips requested." /> : clips.map((clip) => (
              <TableRow key={clip.id}>
                <TableCell>{new Date(clip.requestedAtUtc).toLocaleString()}</TableCell>
                <TableCell>{names.get(clip.surveillanceCameraId) ?? clip.surveillanceCameraId}</TableCell>
                <TableCell>{new Date(clip.requestedFromUtc).toLocaleTimeString()} - {new Date(clip.requestedToUtc).toLocaleTimeString()}</TableCell>
                <TableCell><StatusBadge value={clip.status} /></TableCell>
                <TableCell>{clip.attemptCount}</TableCell>
                <TableCell className="max-w-[240px] truncate">{clip.externalClipReference ?? clip.failureReason ?? '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
