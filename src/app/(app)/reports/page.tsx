'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { useAuthProtection } from '@/hooks/use-auth-protection';
import { useSession } from '@/providers/session-provider';
import { useToast } from '@/hooks/use-toast';
import { fetchAuditLog, downloadComplianceCsv, type AuditLogEntry } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

export default function ReportsPage() {
  const { loading: authLoading, isAuthorized, UnauthorizedComponent } = useAuthProtection(['Admin', 'Operator Admin', 'Manager']);
  const { token } = useSession();
  const { toast } = useToast();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setEntries(await fetchAuditLog(token, { take: 100 }));
    } catch {
      // best-effort
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const handleExport = async () => {
    if (!token) return;
    setBusy(true);
    try {
      await downloadComplianceCsv(token);
      toast({ title: 'Report exported', description: 'The compliance report CSV has been downloaded.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Export failed', description: error.message ?? 'Could not export the report.' });
    } finally {
      setBusy(false);
    }
  };

  if (authLoading) return <Skeleton className="h-64 w-full" />;
  if (!isAuthorized) return <UnauthorizedComponent />;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audit &amp; Reports</h1>
          <p className="text-muted-foreground">The immutable activity trail and audit-ready compliance export.</p>
        </div>
        <Button onClick={handleExport} disabled={busy}>
          <Download className="mr-2 h-4 w-4" />
          {busy ? 'Exporting…' : 'Export compliance report (CSV)'}
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Recent audit activity</CardTitle>
          <CardDescription>Who did what, and when — the latest 100 recorded actions.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When (UTC)</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead>Actor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No audit activity recorded.</TableCell></TableRow>
                ) : entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-xs">{e.occurredAtUtc.slice(0, 19).replace('T', ' ')}</TableCell>
                    <TableCell>{e.actionType}</TableCell>
                    <TableCell>{e.entityType}</TableCell>
                    <TableCell className="max-w-md truncate">{e.summary}</TableCell>
                    <TableCell className="text-muted-foreground">{e.actorRole ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
