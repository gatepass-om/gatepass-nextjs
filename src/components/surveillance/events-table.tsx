'use client';

import type { SurveillanceEvent } from '@/lib/surveillance-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyRow, StatusBadge } from '@/components/smart-access/common';

export function SurveillanceEventsTable({ events }: { events: SurveillanceEvent[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Surveillance Events</CardTitle>
        <CardDescription>VMS telemetry correlated independently from gate and smart-lock events.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Occurred</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Correlation</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.length === 0 ? <EmptyRow colSpan={5} label="No surveillance events found." /> : events.map((event) => (
              <TableRow key={event.id}>
                <TableCell>{new Date(event.occurredAtUtc).toLocaleString()}</TableCell>
                <TableCell>{event.eventType}</TableCell>
                <TableCell><StatusBadge value={event.severity} /></TableCell>
                <TableCell>{event.message ?? '-'}</TableCell>
                <TableCell className="font-mono text-xs">{event.correlationKey ?? event.externalEventId ?? '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
