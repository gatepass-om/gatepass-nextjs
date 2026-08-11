'use client';

import { Skeleton } from '@/components/ui/skeleton';
import type { DashboardSummary } from '@/lib/api';
import Link from 'next/link';
import { AlertTriangle, Clock3, ListChecks, ShieldX, type LucideIcon } from 'lucide-react';

type OperationsActionQueueProps = {
  summary: DashboardSummary | null;
  isLoading?: boolean;
};

type QueueItem = {
  key: string;
  label: string;
  value: string | number;
  overdueCount: number;
  oldestAtUtc?: string | null;
  href: string;
  icon: LucideIcon;
  tint: string;
  pill: string;
};

export function OperationsActionQueue({ summary, isLoading = false }: OperationsActionQueueProps) {
  const items: QueueItem[] = (summary?.actionQueue ?? [])
    .filter((item) => item.applicable && item.count > 0)
    .map((item) => {
      const danger = item.severity === 'danger';
      return {
        key: item.key,
        label: item.label,
        value: item.count,
        overdueCount: item.overdueCount,
        oldestAtUtc: item.oldestAtUtc,
        href: item.href,
        icon: danger ? ShieldX : item.overdueCount > 0 ? AlertTriangle : Clock3,
        tint: danger
          ? 'bg-destructive/15 text-destructive ring-1 ring-inset ring-destructive/30'
          : 'bg-warning/15 text-warning ring-1 ring-inset ring-warning/30',
        pill: danger
          ? 'bg-destructive/15 text-destructive border border-destructive/30'
          : 'bg-warning/15 text-warning border border-warning/30',
      };
    });

  return (
    <div className="ops-panel p-5">
      <div className="mb-4 flex items-center gap-2">
        <ListChecks className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Operations Queue</h3>
      </div>
      <div className="space-y-2.5">
        {!isLoading && items.length === 0 ? (
          <p className="rounded-lg border border-border/70 bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
            No outstanding actions in this scope.
          </p>
        ) : items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={item.href}
              className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5 transition-colors hover:bg-muted/50"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${item.tint}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm text-foreground">{item.label}</span>
                  {item.overdueCount > 0 ? (
                    <span className="block text-[11px] text-warning">{item.overdueCount} overdue</span>
                  ) : item.oldestAtUtc ? (
                    <span className="block text-[11px] text-muted-foreground">
                      Oldest {new Date(item.oldestAtUtc).toLocaleDateString()}
                    </span>
                  ) : null}
                </span>
              </div>
              {isLoading ? (
                <Skeleton className="h-6 w-12" />
              ) : (
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${item.pill}`}>
                  {item.value}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
