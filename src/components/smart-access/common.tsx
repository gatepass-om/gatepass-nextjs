'use client';

import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TableCell, TableRow } from '@/components/ui/table';

export function StatusBadge({ value }: { value?: string | null }) {
  const normalized = value ?? 'Unknown';
  const variant = ['Succeeded', 'Provisioned', 'Active', 'Online', 'Info'].includes(normalized)
    ? 'default'
    : ['Failed', 'Denied', 'Unsupported', 'Offline', 'Critical', 'Error'].includes(normalized)
      ? 'destructive'
      : 'secondary';

  return <Badge variant={variant}>{normalized}</Badge>;
}

export function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="h-20 text-center text-muted-foreground">
        {label}
      </TableCell>
    </TableRow>
  );
}

export function SummaryCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
