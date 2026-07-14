'use client';

import { Skeleton } from '@/components/ui/skeleton';
import type { DashboardSummary } from '@/lib/api';
import { CheckCircle2, Clock3, ListChecks, RadioTower, ShieldX, type LucideIcon } from 'lucide-react';

type OperationsActionQueueProps = {
  summary: DashboardSummary | null;
  isLoading?: boolean;
};

type QueueItem = {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tint: string;
  pill: string;
};

export function OperationsActionQueue({ summary, isLoading = false }: OperationsActionQueueProps) {
  const items: QueueItem[] = [
    {
      label: 'Pending access approvals',
      value: summary?.pendingRequests ?? 0,
      icon: Clock3,
      tint: 'bg-warning/15 text-warning ring-1 ring-inset ring-warning/30',
      pill: 'bg-warning/15 text-warning border border-warning/30',
    },
    {
      label: 'Denied requests to review',
      value: summary?.deniedRequests ?? 0,
      icon: ShieldX,
      tint: 'bg-destructive/15 text-destructive ring-1 ring-inset ring-destructive/30',
      pill: 'bg-destructive/15 text-destructive border border-destructive/30',
    },
    {
      label: 'Approved active permissions',
      value: summary?.approvedRequests ?? 0,
      icon: CheckCircle2,
      tint: 'bg-success/15 text-success ring-1 ring-inset ring-success/30',
      pill: 'bg-success/15 text-success border border-success/30',
    },
    {
      label: 'Gate sync status',
      value: summary ? 'Live' : 'Waiting',
      icon: RadioTower,
      tint: 'bg-accent/15 text-accent ring-1 ring-inset ring-accent/30',
      pill: summary
        ? 'bg-success/15 text-success border border-success/30'
        : 'bg-muted/60 text-muted-foreground border border-border',
    },
  ];

  return (
    <div className="ops-panel p-5">
      <div className="mb-4 flex items-center gap-2">
        <ListChecks className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Operations Queue</h3>
      </div>
      <div className="space-y-2.5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5 transition-colors hover:bg-muted/50"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${item.tint}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="truncate text-sm text-foreground">{item.label}</span>
              </div>
              {isLoading ? (
                <Skeleton className="h-6 w-12" />
              ) : (
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${item.pill}`}>
                  {item.value}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
