'use client';

import type { DeviceCommand } from '@/lib/smart-access-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyRow, StatusBadge } from './common';

export function CommandsTable({ commands }: { commands: DeviceCommand[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Device Commands</CardTitle>
        <CardDescription>Remote command history for capable providers and devices.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Requested</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Failure</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {commands.length === 0 ? <EmptyRow colSpan={4} label="No device commands found." /> : commands.map((command) => (
              <TableRow key={command.id}>
                <TableCell>{new Date(command.requestedAtUtc).toLocaleString()}</TableCell>
                <TableCell>{command.commandType}</TableCell>
                <TableCell><StatusBadge value={command.status} /></TableCell>
                <TableCell>{command.failureReason ?? '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
