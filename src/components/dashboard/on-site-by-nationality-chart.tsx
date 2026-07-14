'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { PieChart, Pie, Cell } from 'recharts';
import { Globe2 } from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import type { DashboardBreakdown } from '@/lib/api';

interface ChartProps {
  className?: string;
  data: DashboardBreakdown[];
  isLoading?: boolean;
}

const PALETTE = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export function OnSiteByNationalityChart({ className, data, isLoading = false }: ChartProps) {
  const chartData = data.map((item) => ({ name: item.name, value: item.count }));
  const chartConfig = chartData.reduce<ChartConfig>((config, item, index) => {
    config[item.name] = {
      label: item.name,
      color: PALETTE[index % PALETTE.length],
    };
    return config;
  }, {});

  return (
    <div className={`ops-panel p-5 ${className ?? ''}`}>
      <div className="mb-1 flex items-center gap-2">
        <Globe2 className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">On-Site by Nationality</h3>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">Nationality breakdown of all on-site personnel.</p>
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
          <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[300px]">
            <PieChart>
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                outerRadius={100}
                innerRadius={52}
                paddingAngle={2}
                stroke="hsl(var(--card))"
                strokeWidth={2}
              >
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={chartConfig[entry.name]?.color} />
                ))}
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey="name" />} />
            </PieChart>
          </ChartContainer>
        )}
      </div>
    </div>
  );
}
