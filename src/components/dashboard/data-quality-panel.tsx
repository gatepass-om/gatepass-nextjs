'use client';

import type { DashboardSummary } from '@/lib/api';

export function DataQualityPanel({ summary }: { summary: DashboardSummary | null }) {
  const quality = summary?.dataQuality;
  const issues = [
    ['Missing profiles', quality?.missingWorkerProfiles ?? 0],
    ['Missing identity', quality?.missingIdentityDocuments ?? 0],
    ['Unverified identity', quality?.unverifiedIdentityDocuments ?? 0],
    ['Missing contractor', quality?.missingContractor ?? 0],
    ['Missing job title', quality?.missingJobTitle ?? 0],
    ['Missing usable card', quality?.missingUsableCards ?? 0],
    ['Stale presence', quality?.stalePresenceRecords ?? 0],
    ['Occupancy mismatch', quality?.occupancyMismatchSites ?? 0],
  ] as const;

  return (
    <section className="ops-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Data quality</h2>
          <p className="mt-1 text-xs text-muted-foreground">Registration completeness and operational reconciliation.</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold tabular-nums text-foreground">{quality?.profileCompletenessRate ?? 0}%</div>
          <div className="text-xs text-muted-foreground">core profile complete</div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {issues.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
            <div className={value > 0 ? 'font-semibold tabular-nums text-warning' : 'font-semibold tabular-nums text-success'}>{value}</div>
            <div className="text-[11px] text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
