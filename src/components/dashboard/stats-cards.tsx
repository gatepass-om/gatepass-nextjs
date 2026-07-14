'use client';

import { AlertOctagon, ClipboardCheck, Clock, LogIn, type LucideIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { DashboardSummary } from '@/lib/api';

interface StatsCardsProps {
  summary: DashboardSummary | null;
  isLoading?: boolean;
}

type StatCard = {
  title: string;
  eyebrow: string;
  value: number;
  description: string;
  icon: LucideIcon;
  tint: string;
};

export function StatsCards({ summary, isLoading = false }: StatsCardsProps) {
  const cards: StatCard[] = [
    {
      title: 'Currently On-Site',
      eyebrow: 'On-Site',
      value: summary?.totalOnSite ?? 0,
      description: 'Personnel on-site now',
      icon: LogIn,
      tint: 'bg-primary/15 text-primary ring-1 ring-inset ring-primary/30',
    },
    {
      title: 'Pending Requests',
      eyebrow: 'Pending',
      value: summary?.pendingRequests ?? 0,
      description: 'Awaiting approval',
      icon: Clock,
      tint: 'bg-warning/15 text-warning ring-1 ring-inset ring-warning/30',
    },
    {
      title: 'Approved Requests',
      eyebrow: 'Approved',
      value: summary?.approvedRequests ?? 0,
      description: 'Approved in scope',
      icon: ClipboardCheck,
      tint: 'bg-success/15 text-success ring-1 ring-inset ring-success/30',
    },
    {
      title: 'Denied Requests',
      eyebrow: 'Denied',
      value: summary?.deniedRequests ?? 0,
      description: 'Denied in scope',
      icon: AlertOctagon,
      tint: 'bg-destructive/15 text-destructive ring-1 ring-inset ring-destructive/30',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.title} className="ops-panel p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="eyebrow">{card.eyebrow}</p>
                {isLoading ? (
                  <Skeleton className="mt-2 h-9 w-16" />
                ) : (
                  <div className="metric-value mt-1.5">{card.value.toLocaleString()}</div>
                )}
              </div>
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${card.tint}`}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{card.description}</p>
          </div>
        );
      })}
    </div>
  );
}
