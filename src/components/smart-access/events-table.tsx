'use client';

import type { DeviceEvent } from '@/lib/smart-access-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyRow, StatusBadge } from './common';

export function EventsTable({ events }: { events: DeviceEvent[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Device Events</CardTitle>
        <CardDescription>Provider telemetry imported separately from gate activity.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Message</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.length === 0 ? <EmptyRow colSpan={4} label="No device events found." /> : events.map((event) => (
              <TableRow key={event.id}>
                <TableCell>{new Date(event.occurredAtUtc).toLocaleString()}</TableCell>
                <TableCell>{event.eventType}</TableCell>
                <TableCell><StatusBadge value={event.severity} /></TableCell>
                <TableCell>{event.message ?? event.externalEventId ?? '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
