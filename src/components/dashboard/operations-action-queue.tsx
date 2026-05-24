'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { DashboardSummary } from '@/lib/api';
import { AlertCircle, CheckCircle2, Clock3, RadioTower, ShieldX } from 'lucide-react';

type OperationsActionQueueProps = {
  summary: DashboardSummary | null;
  isLoading?: boolean;
};

export function OperationsActionQueue({ summary, isLoading = false }: OperationsActionQueueProps) {
  const items = [
    {
      label: 'Pending access approvals',
      value: summary?.pendingRequests ?? 0,
      icon: Clock3,
      tone: 'text-amber-700 bg-amber-50 border-amber-200',
    },
    {
      label: 'Denied requests to review',
      value: summary?.deniedRequests ?? 0,
      icon: ShieldX,
      tone: 'text-rose-700 bg-rose-50 border-rose-200',
    },
    {
      label: 'Approved active permissions',
      value: summary?.approvedRequests ?? 0,
      icon: CheckCircle2,
      tone: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    },
    {
      label: 'Gate sync status',
      value: summary ? 'Live' : 'Waiting',
      icon: RadioTower,
      tone: 'text-cyan-700 bg-cyan-50 border-cyan-200',
    },
  ];

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
          Operations Queue
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <Badge variant="outline" className={`h-8 w-8 justify-center rounded-md p-0 ${item.tone}`}>
                  <Icon className="h-4 w-4" />
                </Badge>
                <span className="truncate text-sm">{item.label}</span>
              </div>
              {isLoading ? <Skeleton className="h-5 w-10" /> : <span className="text-sm font-semibold">{item.value}</span>}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
