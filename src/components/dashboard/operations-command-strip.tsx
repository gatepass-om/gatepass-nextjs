'use client';

import { Skeleton } from '@/components/ui/skeleton';
import type { DashboardSummary } from '@/lib/api';
import { AlertTriangle, CheckCircle2, Clock3, MapPin, Radio, ShieldAlert, UsersRound, type LucideIcon } from 'lucide-react';

type OperationsCommandStripProps = {
  summary: DashboardSummary | null;
  isLoading?: boolean;
};

type OperationalState = {
  label: string;
  className: string;
  icon: LucideIcon;
};

function getOperationalState(summary: DashboardSummary | null): OperationalState {
  if (!summary) {
    return { label: 'Syncing', className: 'bg-muted/60 text-muted-foreground border-border', icon: Clock3 };
  }
  if (summary.deniedRequests > 0) {
    return { label: 'Review denials', className: 'bg-destructive/15 text-destructive border-destructive/30', icon: ShieldAlert };
  }
  if (summary.pendingRequests > 0) {
    return { label: 'Approval queue', className: 'bg-warning/15 text-warning border-warning/30', icon: AlertTriangle };
  }
  return { label: 'Normal', className: 'bg-success/15 text-success border-success/30', icon: CheckCircle2 };
}

export function OperationsCommandStrip({ summary, isLoading = false }: OperationsCommandStripProps) {
  const state = getOperationalState(summary);
  const StateIcon = state.icon;
  const activeSites = summary?.sites.filter((site) => site.count > 0).length ?? 0;
  const movementCount = summary?.recentActivity.length ?? 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_15rem_15rem]">
      <div className="ops-panel relative overflow-hidden p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-2xl"
        />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${state.className}`}>
                <StateIcon className="h-3.5 w-3.5" />
                {state.label}
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Radio className="h-3.5 w-3.5 text-accent" />
                Live operations summary
              </span>
            </div>
            <div>
              <p className="eyebrow">Command Overview</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">GatePass Operations</h2>
              <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
                Personnel presence, access approvals, and gate movement in the selected operational scope.
              </p>
            </div>
          </div>
          <div className="flex items-end gap-3 sm:flex-col sm:items-end sm:gap-1">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-inset ring-primary/30">
                <UsersRound className="h-6 w-6" />
              </div>
              <div className="text-right">
                {isLoading ? (
                  <Skeleton className="ml-auto h-10 w-20" />
                ) : (
                  <div className="text-4xl font-bold tabular-nums text-foreground">{summary?.totalOnSite ?? 0}</div>
                )}
                <div className="eyebrow mt-0.5">On Site Now</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="ops-panel p-5">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-accent" />
          <p className="eyebrow">Active Sites</p>
        </div>
        {isLoading ? (
          <Skeleton className="mt-3 h-9 w-16" />
        ) : (
          <div className="metric-value mt-2">{activeSites}</div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">Sites with current occupancy</p>
      </div>

      <div className="ops-panel p-5">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-primary" />
          <p className="eyebrow">Recent Movements</p>
        </div>
        {isLoading ? (
          <Skeleton className="mt-3 h-9 w-16" />
        ) : (
          <div className="metric-value mt-2">{movementCount}</div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">Latest gate events in scope</p>
      </div>
    </div>
  );
}
