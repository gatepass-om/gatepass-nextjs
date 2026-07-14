'use client';

import type { GeoRegion } from '@/lib/location-governance-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyLocationRow, LocationStatusBadge } from './common';

export function GeofenceRegistryTable({ geofences, loading }: { geofences: GeoRegion[]; loading: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Geofence Registry</CardTitle>
        <CardDescription>Operational regions used for access validation and subcontractor work-scope monitoring.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-56 w-full" /> : (
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
              {geofences.length === 0 ? <EmptyLocationRow colSpan={5} label="No geofences found." /> : geofences.map((region) => (
                <TableRow key={region.id}>
                  <TableCell className="font-medium">{region.name}</TableCell>
                  <TableCell>{region.siteName ?? region.contractorName ?? region.operatorName ?? 'Platform'}</TableCell>
                  <TableCell>
                    {region.shape === 'Circle'
                      ? `Circle (${region.radiusMeters ?? 0}m)`
                      : `Polygon (${region.polygon.length} points)`}
                  </TableCell>
                  <TableCell>{region.governanceMode}</TableCell>
                  <TableCell><LocationStatusBadge value={region.isActive ? 'Active' : 'Inactive'} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
