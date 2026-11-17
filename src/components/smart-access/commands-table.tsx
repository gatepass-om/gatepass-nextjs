'use client';

import type { DeviceCommand } from '@/lib/smart-access-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyRow, StatusBadge } from './common';

export function CommandsTable({ commands }: { commands: DeviceCommand[] }) {
  const summarizeResult = (command: DeviceCommand) => {
    if (command.failureReason) return command.failureReason;
    if (!command.resultPayloadJson) return command.externalCommandId ?? '-';
    try {
      const parsed = JSON.parse(command.resultPayloadJson);
      if (parsed?.operationResult?.type) return String(parsed.operationResult.type);
      if (parsed?.status) return String(parsed.status);
      if (parsed?.command) return `${parsed.command}: ${parsed.status ?? 'sent'}`;
    } catch {
      return command.resultPayloadJson.slice(0, 96);
    }
    return command.resultPayloadJson.slice(0, 96);
  };

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
              <TableHead>Completed</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Provider Response</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {commands.length === 0 ? <EmptyRow colSpan={5} label="No device commands found." /> : commands.map((command) => (
              <TableRow key={command.id}>
                <TableCell>{new Date(command.requestedAtUtc).toLocaleString()}</TableCell>
                <TableCell>{command.completedAtUtc ? new Date(command.completedAtUtc).toLocaleString() : '-'}</TableCell>
                <TableCell>{command.commandType}</TableCell>
                <TableCell><StatusBadge value={command.status} /></TableCell>
                <TableCell className="max-w-[360px] truncate">{summarizeResult(command)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
