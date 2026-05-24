'use client';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { DashboardSummary } from '@/lib/api';
import { AlertTriangle, CheckCircle2, Clock3, ShieldAlert, UsersRound } from 'lucide-react';

type OperationsCommandStripProps = {
  summary: DashboardSummary | null;
  isLoading?: boolean;
};

function getOperationalState(summary: DashboardSummary | null) {
  if (!summary) return { label: 'Syncing', className: 'bg-slate-100 text-slate-700 border-slate-200', icon: Clock3 };
  if (summary.deniedRequests > 0) return { label: 'Review denials', className: 'bg-rose-50 text-rose-700 border-rose-200', icon: ShieldAlert };
  if (summary.pendingRequests > 0) return { label: 'Approval queue', className: 'bg-amber-50 text-amber-700 border-amber-200', icon: AlertTriangle };
  return { label: 'Normal', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 };
}

export function OperationsCommandStrip({ summary, isLoading = false }: OperationsCommandStripProps) {
  const state = getOperationalState(summary);
  const StateIcon = state.icon;
  const activeSites = summary?.sites.filter((site) => site.count > 0).length ?? 0;
  const movementCount = summary?.recentActivity.length ?? 0;

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem_18rem]">
      <Card className="overflow-hidden border-slate-200 bg-slate-950 text-white shadow-sm">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={`border ${state.className}`}>
                <StateIcon className="mr-1.5 h-3.5 w-3.5" />
                {state.label}
              </Badge>
              <span className="text-xs text-slate-300">Live operations summary</span>
            </div>
            <div>
              <h2 className="text-2xl font-semibold leading-tight">GatePass Operations</h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-300">
                Personnel presence, access approvals, and gate movement in the selected operational scope.
              </p>
            </div>
          </div>
          <div className="flex items-end gap-3">
            <UsersRound className="mb-1 h-7 w-7 text-cyan-300" />
            <div className="text-right">
              {isLoading ? <Skeleton className="ml-auto h-9 w-20 bg-white/20" /> : <div className="text-4xl font-bold">{summary?.totalOnSite ?? 0}</div>}
              <div className="text-xs uppercase tracking-wide text-slate-300">on site now</div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="border-slate-200 p-5">
        <div className="text-sm text-muted-foreground">Active sites</div>
        {isLoading ? <Skeleton className="mt-3 h-8 w-16" /> : <div className="mt-2 text-3xl font-semibold">{activeSites}</div>}
        <p className="mt-1 text-xs text-muted-foreground">Sites with current occupancy</p>
      </Card>

      <Card className="border-slate-200 p-5">
        <div className="text-sm text-muted-foreground">Recent movements</div>
        {isLoading ? <Skeleton className="mt-3 h-8 w-16" /> : <div className="mt-2 text-3xl font-semibold">{movementCount}</div>}
        <p className="mt-1 text-xs text-muted-foreground">Latest gate events in scope</p>
      </Card>
    </div>
  );
}
