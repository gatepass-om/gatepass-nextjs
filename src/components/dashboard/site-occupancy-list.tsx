'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { DashboardBreakdown } from '@/lib/api';
import { MapPin } from 'lucide-react';

type SiteOccupancyListProps = {
  sites: DashboardBreakdown[];
  totalOnSite: number;
  isLoading?: boolean;
};

export function SiteOccupancyList({ sites, totalOnSite, isLoading = false }: SiteOccupancyListProps) {
  const rankedSites = [...sites].sort((a, b) => b.count - a.count).slice(0, 6);

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          Site Occupancy
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-9 w-full" />)
        ) : rankedSites.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No personnel currently on site.</div>
        ) : (
          rankedSites.map((site) => {
            const percent = totalOnSite > 0 ? Math.round((site.count / totalOnSite) * 100) : 0;
            return (
              <div key={site.id} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-medium">{site.name}</span>
                  <span className="shrink-0 text-muted-foreground">{site.count}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-cyan-600" style={{ width: `${Math.max(percent, site.count > 0 ? 8 : 0)}%` }} />
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
