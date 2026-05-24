'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PieChart, Pie, Cell } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import type { DashboardBreakdown } from '@/lib/api';

interface ChartProps {
  className?: string;
  data: DashboardBreakdown[];
  isLoading?: boolean;
}

export function OnSiteByNationalityChart({ className, data, isLoading = false }: ChartProps) {
  const chartData = data.map((item) => ({ name: item.name, value: item.count }));
  const chartConfig = chartData.reduce<ChartConfig>((config, item, index) => {
    const colors = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];
    config[item.name] = {
      label: item.name,
      color: colors[index % colors.length],
    };
    return config;
  }, {});

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </CardHeader>
        <CardContent className="flex h-[200px] items-center justify-center">
          <Skeleton className="h-40 w-40 rounded-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>On-Site by Nationality</CardTitle>
        <CardDescription>Nationality breakdown of all on-site personnel.</CardDescription>
      </CardHeader>
      <CardContent className="h-[300px]">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">No on-site data available.</div>
        ) : (
          <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[300px]">
            <PieChart>
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
              <Pie data={chartData} dataKey="value" nameKey="name" outerRadius={100}>
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={chartConfig[entry.name]?.color} />
                ))}
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey="name" />} />
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
