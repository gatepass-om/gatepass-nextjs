'use client';

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
    <div className="ops-panel p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Site Occupancy</h3>
        </div>
        {!isLoading && (
          <span className="text-xs text-muted-foreground tabular-nums">{totalOnSite} on site</span>
        )}
      </div>
      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-10 w-full" />)
        ) : rankedSites.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            No personnel currently on site.
          </div>
        ) : (
          rankedSites.map((site) => {
            const percent = totalOnSite > 0 ? Math.round((site.count / totalOnSite) * 100) : 0;
            return (
              <div key={site.id} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-medium text-foreground">{site.name}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {site.count}
                    <span className="ml-1 text-xs">({percent}%)</span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted/60">
                  <div
                    className="h-2 rounded-full bg-primary transition-all"
                    style={{ width: `${Math.max(percent, site.count > 0 ? 6 : 0)}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
