'use client';

import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TableCell, TableRow } from '@/components/ui/table';

export function LocationStatusBadge({ value }: { value?: string | null }) {
  const normalized = value ?? 'Unknown';
  const variant = ['Active', 'Inside', 'Closed', 'Low'].includes(normalized)
    ? 'default'
    : ['Outside', 'Open', 'Critical', 'High'].includes(normalized)
      ? 'destructive'
      : 'secondary';

  return <Badge variant={variant}>{normalized}</Badge>;
}

export function LocationSummaryCard({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  helper?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {helper && <p className="mt-1 text-xs text-muted-foreground">{helper}</p>}
      </CardContent>
    </Card>
  );
}

export function EmptyLocationRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="h-24 text-center text-muted-foreground">
        {label}
      </TableCell>
    </TableRow>
  );
}

export function formatWindow(from: string, to?: string | null) {
  const start = new Date(from).toLocaleString();
  const end = to ? new Date(to).toLocaleString() : 'Open-ended';
  return `${start} - ${end}`;
}
