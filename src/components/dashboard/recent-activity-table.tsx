
'use client';

import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { DashboardRecentActivity } from '@/lib/api';
import { formatDistanceToNow, format } from 'date-fns';
import { Loader2, LogIn, LogOut, Briefcase } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface RecentActivityTableProps {
  activity: DashboardRecentActivity[];
  isLoading?: boolean;
}

const ActivityTableRow = ({ activityItem }: { activityItem: DashboardRecentActivity }) => {
    const getInitials = (name: string) => {
        if (!name) return '';
        return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
    }
    
    const activityDate = new Date(activityItem.occurredAtUtc);
    const isCheckIn = activityItem.activityType === 'CheckIn' || activityItem.activityType === 'Check-in';
    const activityLabel = isCheckIn ? 'Check-in' : 'Check-out';

    return (
        <TableRow>
            <TableCell>
            <div className="flex items-center gap-3">
                <div className="h-9 w-9 flex items-center justify-center rounded-full bg-muted text-muted-foreground font-semibold">
                    {getInitials(activityItem.userName)}
                </div>
                <div className="font-medium whitespace-nowrap">{activityItem.userName}</div>
            </div>
            </TableCell>
            <TableCell>
                <div className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Briefcase className="h-3 w-3" />
                    <span>{activityItem.jobTitle || activityItem.workerCode || 'N/A'}</span>
                </div>
            </TableCell>
            <TableCell>
                <Badge variant={isCheckIn ? 'default' : 'secondary'} className={`flex items-center gap-1.5 w-fit ${isCheckIn ? 'bg-blue-500/20 text-blue-700 border-transparent hover:bg-blue-500/30' : 'bg-gray-500/20 text-gray-700 border-transparent hover:bg-gray-500/30'}`}>
                    {isCheckIn ? <LogIn className="h-3 w-3" /> : <LogOut className="h-3 w-3" />}
                    {activityLabel}
                </Badge>
            </TableCell>
             <TableCell>
                <span className="text-sm text-muted-foreground">{activityItem.siteName}</span>
            </TableCell>
            <TableCell className="text-right whitespace-nowrap">
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger>
                        <span className="text-muted-foreground">{formatDistanceToNow(activityDate, { addSuffix: true })}</span>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{format(activityDate, 'PPP p')}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
            </TableCell>
        </TableRow>
    )
}


export function RecentActivityTable({ activity, isLoading = false }: RecentActivityTableProps) {
  
  const sortedActivity = activity.sort((a,b) => {
    const timeA = new Date(a.occurredAtUtc).getTime();
    const timeB = new Date(b.occurredAtUtc).getTime();
    return timeB - timeA;
  }).slice(0, 10); // Get latest 10 activities

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Gate Activity</CardTitle>
        <CardDescription>A log of the most recent check-ins and check-outs.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Personnel</TableHead>
                <TableHead>Job Title</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Site</TableHead>
                <TableHead className="text-right">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="h-56 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></TableCell></TableRow>
              ) : sortedActivity.length > 0 ? (
                sortedActivity.map((item) => (
                    <ActivityTableRow key={item.id} activityItem={item} />
                ))
              ) : (
                <TableRow><TableCell colSpan={5} className="h-56 text-center">No recent activity found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
