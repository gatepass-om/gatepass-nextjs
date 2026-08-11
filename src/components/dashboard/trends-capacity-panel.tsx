'use client';

import type { DashboardSummary } from '@/lib/api';

export function TrendsCapacityPanel({ summary }: { summary: DashboardSummary | null }) {
  const trends = summary?.trends ?? [];
  const maxMovements = Math.max(1, ...trends.map((point) => point.movements));
  const bottlenecks = [...(summary?.bottlenecks ?? [])]
    .filter((item) => item.count > 0)
    .sort((left, right) => right.overdueCount - left.overdueCount || right.count - left.count)
    .slice(0, 5);
  const change = summary?.comparison.movementChangePercent;

  return (
    <section className="ops-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Trends and capacity</h2>
          <p className="mt-1 text-xs text-muted-foreground">Daily movement, same-length period comparison, and configured site limits.</p>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold tabular-nums text-foreground">
            {change === null || change === undefined ? 'No prior baseline' : `${change > 0 ? '+' : ''}${change}%`}
          </div>
          <div className="text-xs text-muted-foreground">movement vs previous period</div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem_18rem]">
        <div>
          <div className="flex min-h-40 items-end gap-2 rounded-lg border border-border/70 bg-muted/20 p-3">
            {trends.length === 0 ? (
              <p className="m-auto text-sm text-muted-foreground">No movement events in this window.</p>
            ) : trends.map((point) => (
              <div key={point.date} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
                <span className="text-[10px] font-medium tabular-nums text-muted-foreground">{point.movements}</span>
                <div
                  className="w-full max-w-10 rounded-t bg-primary/80"
                  style={{ height: `${Math.max(6, point.movements * 110 / maxMovements)}px` }}
                  title={`${point.date}: ${point.movements} movements`}
                />
                <span className="max-w-full truncate text-[10px] text-muted-foreground">{point.date.slice(5)}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Current: {summary?.comparison.currentMovements ?? 0} movements · Previous: {summary?.comparison.previousMovements ?? 0}
          </p>
        </div>

        <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Capacity</h3>
          {(summary?.capacity.configuredSites ?? 0) === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No site capacity is configured. Add it only where a meaningful limit exists.</p>
          ) : (
            <>
              <div className="mt-2 text-3xl font-bold tabular-nums">{summary?.capacity.occupancyRate ?? 0}%</div>
              <p className="text-xs text-muted-foreground">
                {summary?.capacity.currentOccupancy ?? 0}/{summary?.capacity.totalCapacity ?? 0} across configured sites
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary" style={{ width: `${Math.min(100, summary?.capacity.occupancyRate ?? 0)}%` }} />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {summary?.capacity.atCapacitySites ?? 0} at capacity · {summary?.capacity.overCapacitySites ?? 0} over capacity
              </p>
            </>
          )}
        </div>

        <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Top bottlenecks</h3>
          {bottlenecks.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No active bottlenecks.</p>
          ) : (
            <ol className="mt-3 space-y-2">
              {bottlenecks.map((item) => (
                <li key={item.key} className="flex items-center justify-between gap-3 text-xs">
                  <span className="truncate text-muted-foreground">{item.label}</span>
                  <span className="shrink-0 font-semibold tabular-nums text-foreground">
                    {item.count}{item.overdueCount > 0 ? ` · ${item.overdueCount} overdue` : ''}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-4 border-t border-border pt-5 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Turnaround</h3>
          <p className="mt-2 text-sm font-semibold text-foreground">Approval decisions</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Median {formatHours(summary?.turnaround.approvals.medianHours)} · 90% within {formatHours(summary?.turnaround.approvals.p90Hours)}
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Based on {summary?.turnaround.approvals.sampleSize ?? 0} completed decisions in this window.
          </p>
        </div>
        <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Onboarding turnaround</h3>
          <p className="mt-2 text-sm font-semibold text-foreground">Worker clearance</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Median {formatHours(summary?.turnaround.onboarding.medianHours)} · 90% within {formatHours(summary?.turnaround.onboarding.p90Hours)}
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Based on {summary?.turnaround.onboarding.sampleSize ?? 0} completed clearances in this window.
          </p>
        </div>
        <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Peak occupancy</h3>
          <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">{summary?.peakOccupancy.total ?? 0}</p>
          <p className="text-xs text-muted-foreground">
            {summary?.peakOccupancy.peakAtUtc
              ? `Highest reconstructed presence at ${new Date(summary.peakOccupancy.peakAtUtc).toLocaleString()}`
              : 'No approved on-site movement was recorded in this window.'}
          </p>
        </div>
        <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Shift attendance</h3>
          {(summary?.attendance.configuredRosters ?? 0) === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">No shift roster is configured, so absence is not inferred.</p>
          ) : (summary?.attendance.activeRosters ?? 0) === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">No configured shift is active at this time.</p>
          ) : (
            <>
              <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">{summary?.attendance.presentWorkers ?? 0}/{summary?.attendance.expectedWorkers ?? 0}</p>
              <p className="text-xs text-muted-foreground">
                present now · {summary?.attendance.absentWorkers ?? 0} rostered workers not on site
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function formatHours(value: number | null | undefined) {
  return value === null || value === undefined ? 'not available' : `${value}h`;
}
