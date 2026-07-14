'use client';

import type { WorkZoneAssignment } from '@/lib/location-governance-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyLocationRow, formatWindow, LocationStatusBadge } from './common';

export function WorkZoneAssignmentsTable({ assignments, loading }: { assignments: WorkZoneAssignment[]; loading: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Work-Zone Assignments</CardTitle>
        <CardDescription>Who is allowed to work inside each monitored region.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-48 w-full" /> : (
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
              {assignments.length === 0 ? <EmptyLocationRow colSpan={4} label="No assignments found." /> : assignments.map((assignment) => (
                <TableRow key={assignment.id}>
                  <TableCell className="font-medium">{assignment.geoRegionName}</TableCell>
                  <TableCell>{assignment.userName ?? assignment.contractorName ?? 'Unassigned'}</TableCell>
                  <TableCell className="text-xs">{formatWindow(assignment.validFromUtc, assignment.validToUtc)}</TableCell>
                  <TableCell><LocationStatusBadge value={assignment.isActive ? 'Active' : 'Inactive'} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
