'use client';

import React from 'react';
import type { DashboardRecentActivity } from '@/lib/api';
import { formatDistanceToNow, format } from 'date-fns';
import { Activity, Briefcase, Loader2, LogIn, LogOut, MapPin } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface RecentActivityTableProps {
  activity: DashboardRecentActivity[];
  isLoading?: boolean;
}

function getInitials(name: string) {
  if (!name) return '';
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const ActivityRow = ({ activityItem }: { activityItem: DashboardRecentActivity }) => {
  const activityDate = new Date(activityItem.occurredAtUtc);
  const isCheckIn = activityItem.activityType === 'CheckIn' || activityItem.activityType === 'Check-in';
  const activityLabel = isCheckIn ? 'Check-in' : 'Check-out';

  return (
    <div className="flex items-center gap-4 rounded-lg border border-border/60 bg-muted/20 px-4 py-3 transition-colors hover:bg-muted/40">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-1 ring-inset ${
          isCheckIn
            ? 'bg-success/15 text-success ring-success/30'
            : 'bg-muted/60 text-muted-foreground ring-border'
        }`}
      >
        {getInitials(activityItem.userName)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate font-medium text-foreground">{activityItem.userName}</span>
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
              isCheckIn
                ? 'border-success/30 bg-success/15 text-success'
                : 'border-border bg-muted/60 text-muted-foreground'
            }`}
          >
            {isCheckIn ? <LogIn className="h-3 w-3" /> : <LogOut className="h-3 w-3" />}
            {activityLabel}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Briefcase className="h-3 w-3" />
            {activityItem.jobTitle || activityItem.workerCode || 'N/A'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3 w-3" />
            {activityItem.siteName}
          </span>
        </div>
      </div>

      <div className="shrink-0 whitespace-nowrap text-right text-xs text-muted-foreground tabular-nums">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>{formatDistanceToNow(activityDate, { addSuffix: true })}</span>
            </TooltipTrigger>
            <TooltipContent>
              <p>{format(activityDate, 'PPP p')}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
};

export function RecentActivityTable({ activity, isLoading = false }: RecentActivityTableProps) {
  const sortedActivity = [...activity]
    .sort((a, b) => new Date(b.occurredAtUtc).getTime() - new Date(a.occurredAtUtc).getTime())
    .slice(0, 10);

  return (
    <div className="ops-panel p-5">
      <div className="mb-4 flex items-center gap-2">
        <Activity className="h-4 w-4 text-accent" />
        <div>
          <h3 className="text-sm font-semibold text-foreground">Recent Gate Activity</h3>
          <p className="text-xs text-muted-foreground">A log of the most recent check-ins and check-outs.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-56 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : sortedActivity.length > 0 ? (
        <div className="space-y-2.5">
          {sortedActivity.map((item) => (
            <ActivityRow key={item.id} activityItem={item} />
          ))}
        </div>
      ) : (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
          No recent activity found.
        </div>
      )}
    </div>
  );
}
