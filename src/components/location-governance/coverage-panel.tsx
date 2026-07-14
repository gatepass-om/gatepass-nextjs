'use client';

import { MapPinned } from 'lucide-react';
import type { GeofenceViolation, GeoRegion, WorkZoneAssignment } from '@/lib/location-governance-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export function CoveragePanel({
  geofences,
  assignments,
  violations,
}: {
  geofences: GeoRegion[];
  assignments: WorkZoneAssignment[];
  violations: GeofenceViolation[];
}) {
  const activeRegions = geofences.filter((region) => region.isActive).length;
  const coverage = geofences.length ? Math.round((activeRegions / geofences.length) * 100) : 0;
  const monitoredAssignments = assignments.filter((assignment) => assignment.isActive).length;
  const openViolations = violations.filter((violation) => violation.status === 'Open').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPinned className="h-5 w-5 text-muted-foreground" />
          Monitoring Posture
        </CardTitle>
        <CardDescription>Current subcontractor geofence coverage and active exception pressure.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">Active region coverage</span>
            <span>{coverage}%</span>
          </div>
          <Progress value={coverage} />
        </div>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-md border p-3">
            <div className="text-lg font-semibold">{activeRegions}</div>
            <div className="text-muted-foreground">active regions</div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-lg font-semibold">{monitoredAssignments}</div>
            <div className="text-muted-foreground">monitored scopes</div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-lg font-semibold">{openViolations}</div>
            <div className="text-muted-foreground">open exceptions</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
