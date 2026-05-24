'use client';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { AccessRequest } from '@/lib/types';
import { AlertTriangle, CheckCircle2, Clock3, FileCheck2, ShieldX, UsersRound } from 'lucide-react';

type RequestWorkflowStripProps = {
  requests: AccessRequest[];
  pendingRequests: AccessRequest[];
  isLoading?: boolean;
};

export function RequestWorkflowStrip({ requests, pendingRequests, isLoading = false }: RequestWorkflowStripProps) {
  const approved = requests.filter((request) => request.status === 'Approved').length;
  const denied = requests.filter((request) => request.status === 'Denied').length;
  const totalWorkers = requests.reduce((sum, request) => sum + (request.workerCount ?? request.workerIds?.length ?? request.workers?.length ?? 0), 0);
  const onSite = requests.reduce((sum, request) => sum + (request.onSiteCount ?? 0), 0);
  const hasQueue = pendingRequests.length > 0;

  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_16rem_16rem_16rem]">
      <Card className="overflow-hidden border-slate-200 bg-slate-950 text-white">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={hasQueue ? 'border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50' : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50'}>
                {hasQueue ? <AlertTriangle className="mr-1.5 h-3.5 w-3.5" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
                {hasQueue ? 'Approval queue active' : 'No pending approvals'}
              </Badge>
              <span className="text-xs text-slate-300">Access governance workflow</span>
            </div>
            <div>
              <h2 className="text-2xl font-semibold leading-tight">Access Request Control</h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-300">
                Review contractor requests, validate worker readiness, and issue controlled access windows.
              </p>
            </div>
          </div>
          <div className="flex items-end gap-3 text-right">
            <FileCheck2 className="mb-1 h-7 w-7 text-cyan-300" />
            <div>
              {isLoading ? <Skeleton className="ml-auto h-9 w-20 bg-white/20" /> : <div className="text-4xl font-bold">{pendingRequests.length}</div>}
              <div className="text-xs uppercase tracking-wide text-slate-300">awaiting decision</div>
            </div>
          </div>
        </div>
      </Card>

      <WorkflowMetric icon={Clock3} label="Pending" value={pendingRequests.length} isLoading={isLoading} tone="text-amber-700 bg-amber-50" />
      <WorkflowMetric icon={CheckCircle2} label="Approved" value={approved} isLoading={isLoading} tone="text-emerald-700 bg-emerald-50" />
      <WorkflowMetric icon={ShieldX} label="Denied" value={denied} isLoading={isLoading} tone="text-rose-700 bg-rose-50" />

      <Card className="border-slate-200 p-4 xl:col-span-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <UsersRound className="h-4 w-4" />
            Personnel covered by visible requests
          </div>
          {isLoading ? (
            <Skeleton className="h-5 w-32" />
          ) : (
            <div className="text-sm font-medium">
              {onSite} currently on site / {totalWorkers} requested workers
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function WorkflowMetric({
  icon: Icon,
  label,
  value,
  isLoading,
  tone,
}: {
  icon: typeof Clock3;
  label: string;
  value: number;
  isLoading?: boolean;
  tone: string;
}) {
  return (
    <Card className="border-slate-200 p-5">
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-md ${tone}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-sm text-muted-foreground">{label}</div>
      {isLoading ? <Skeleton className="mt-2 h-8 w-16" /> : <div className="mt-1 text-3xl font-semibold">{value}</div>}
    </Card>
  );
}
