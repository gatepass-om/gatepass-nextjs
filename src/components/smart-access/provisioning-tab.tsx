'use client';

import type { DeviceAccessAssignment, DeviceSyncJob } from '@/lib/smart-access-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyRow, StatusBadge } from './common';

export function ProvisioningTab({
  assignments,
  syncJobs,
  retryingJobId,
  onRetry,
}: {
  assignments: DeviceAccessAssignment[];
  syncJobs: DeviceSyncJob[];
  retryingJobId: string | null;
  onRetry: (jobId: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Assignments And Sync Jobs</CardTitle>
        <CardDescription>Generated access rights and provider sync status.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sync</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignments.length === 0 ? <EmptyRow colSpan={4} label="No assignments found." /> : assignments.map((assignment) => (
              <TableRow key={assignment.id}>
                <TableCell>{assignment.userId}</TableCell>
                <TableCell>{assignment.accessControlDeviceId ?? assignment.physicalAccessPointId ?? assignment.accessZoneId ?? 'Site scope'}</TableCell>
                <TableCell><StatusBadge value={assignment.status} /></TableCell>
                <TableCell>{assignment.requiresSync ? 'Required' : 'Not required'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Job</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Attempts</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {syncJobs.length === 0 ? <EmptyRow colSpan={5} label="No sync jobs found." /> : syncJobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell className="font-mono text-xs">{job.id}</TableCell>
                <TableCell>{job.jobType}</TableCell>
                <TableCell><StatusBadge value={job.status} /></TableCell>
                <TableCell>{job.attemptCount}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" onClick={() => onRetry(job.id)} disabled={retryingJobId === job.id}>
                    Retry
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
