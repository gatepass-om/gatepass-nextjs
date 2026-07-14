'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { PieChart as PieChartIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { DashboardBreakdown } from '@/lib/api';

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

interface OnSiteByCompanyChartProps {
  className?: string;
  data: DashboardBreakdown[];
  groupByOperator: boolean;
  isLoading?: boolean;
}

export function OnSiteByCompanyChart({ className, data, groupByOperator, isLoading = false }: OnSiteByCompanyChartProps) {
  const chartData = data.map((item) => ({ name: item.name, value: item.count }));
  const chartTitle = groupByOperator ? 'On-Site by Operator' : 'On-Site by Contractor';
  const chartDescription = groupByOperator
    ? 'Distribution of on-site personnel by operator.'
    : 'Breakdown of on-site personnel by contractor.';

  return (
    <div className={`ops-panel p-5 ${className ?? ''}`}>
      <div className="mb-1 flex items-center gap-2">
        <PieChartIcon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">{chartTitle}</h3>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">{chartDescription}</p>
      <div className="h-[300px]">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Skeleton className="h-40 w-40 rounded-full" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No on-site data available.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                innerRadius={48}
                paddingAngle={2}
                stroke="hsl(var(--card))"
                strokeWidth={2}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${entry.name}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted) / 0.4)' }}
                contentStyle={{
                  background: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '0.5rem',
                  color: 'hsl(var(--foreground))',
                  boxShadow: '0 12px 32px -10px hsl(222 80% 2% / 0.8)',
                }}
                itemStyle={{ color: 'hsl(var(--foreground))' }}
                labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
              />
              <Legend
                iconType="circle"
                wrapperStyle={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))' }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
