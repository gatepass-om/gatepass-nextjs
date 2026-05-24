'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import type { DashboardBreakdown } from '@/lib/api';

const COLORS = ['#0D1A2E', '#1E40AF', '#16A34A', '#F59E0B', '#E11D48', '#7C3AED'];

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
    <Card className={className}>
      <CardHeader>
        <CardTitle>{chartTitle}</CardTitle>
        <CardDescription>{chartDescription}</CardDescription>
      </CardHeader>
      <CardContent className="h-[300px]">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">Loading...</div>
        ) : chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">No on-site data available.</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${entry.name}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
