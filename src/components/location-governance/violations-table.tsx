'use client';

import { AlertTriangle } from 'lucide-react';
import type { GeofenceViolation } from '@/lib/location-governance-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyLocationRow, LocationStatusBadge } from './common';

export function ViolationsTable({ violations, loading }: { violations: GeofenceViolation[]; loading: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          Open Violations
        </CardTitle>
        <CardDescription>Compliance exceptions from mobile work-session pings.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-48 w-full" /> : (
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
              {violations.length === 0 ? <EmptyLocationRow colSpan={4} label="No open violations." /> : violations.map((violation) => (
                <TableRow key={violation.id}>
                  <TableCell className="font-medium">{violation.userName}</TableCell>
                  <TableCell>{violation.geoRegionName ?? 'Unknown region'}</TableCell>
                  <TableCell><LocationStatusBadge value={violation.severity} /></TableCell>
                  <TableCell className="text-xs">{new Date(violation.lastDetectedAtUtc).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
