'use client';

import { Card, CardContent } from '@/components/ui/card';
import { AlertOctagon, ClipboardCheck, Clock, LogIn } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { DashboardSummary } from '@/lib/api';

interface StatsCardsProps {
  summary: DashboardSummary | null;
  isLoading?: boolean;
}

export function StatsCards({ summary, isLoading = false }: StatsCardsProps) {
  const cards = [
    {
      title: 'Currently On-Site',
      value: summary?.totalOnSite ?? 0,
      description: 'Personnel on-site now',
      icon: LogIn,
      tone: 'bg-cyan-50 text-cyan-700',
    },
    {
      title: 'Pending Requests',
      value: summary?.pendingRequests ?? 0,
      description: 'Awaiting approval',
      icon: Clock,
      tone: 'bg-amber-50 text-amber-700',
    },
    {
      title: 'Approved Requests',
      value: summary?.approvedRequests ?? 0,
      description: 'Approved in scope',
      icon: ClipboardCheck,
      tone: 'bg-emerald-50 text-emerald-700',
    },
    {
      title: 'Denied Requests',
      value: summary?.deniedRequests ?? 0,
      description: 'Denied in scope',
      icon: AlertOctagon,
      tone: 'bg-rose-50 text-rose-700',
    },
  ];

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title} className="border-slate-200">
            <CardContent className="p-4">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="mb-2 mt-4 h-8 w-14" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title} className="border-slate-200">
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="truncate text-sm text-muted-foreground">{card.title}</p>
              <div className="mt-1 text-2xl font-semibold">{card.value}</div>
              <p className="mt-1 text-xs text-muted-foreground">{card.description}</p>
            </div>
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${card.tone}`}>
              <card.icon className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
