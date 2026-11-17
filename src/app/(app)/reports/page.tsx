'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { useAuthProtection } from '@/hooks/use-auth-protection';
import { useSession } from '@/providers/session-provider';
import { useToast } from '@/hooks/use-toast';
import { fetchAuditLog, downloadComplianceCsv, downloadWorkerTraceability, fetchWorkerTraceability, type AuditLogEntry, type WorkerTraceabilityRow } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useLocale } from '@/providers/locale-provider';
import { getWorkPassStatusPresentation } from '@/components/projects/project-command-center';

function formatAuditDetails(value: string) {
  try { return JSON.stringify(JSON.parse(value), null, 2); }
  catch { return value; }
}

export default function ReportsPage() {
  const { loading: authLoading, isAuthorized, UnauthorizedComponent } = useAuthProtection(['Admin', 'Operator Admin', 'Manager', 'Contractor Admin']);
  const { token, user } = useSession();
  const canViewAudit = Boolean(user && ['Admin', 'Operator Admin', 'Manager'].includes(user.role));
  const { toast } = useToast();
  const { t } = useLocale();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [traceability, setTraceability] = useState<WorkerTraceabilityRow[]>([]);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    if (!token || !isAuthorized) return;
    setLoading(true);
    setLoadError('');
    try {
      const [audit, workerReport] = await Promise.all([
        canViewAudit ? fetchAuditLog(token, { take: 100 }) : Promise.resolve([]),
        fetchWorkerTraceability(token),
      ]);
      setEntries(audit);
      setTraceability(workerReport.rows);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : t('Could not load reports. Try again.'));
    } finally {
      setLoading(false);
    }
  }, [canViewAudit, isAuthorized, t, token]);

  useEffect(() => { void load(); }, [load]);

  const handleExport = async () => {
    if (!token) return;
    setBusy(true);
    try {
      await downloadComplianceCsv(token);
      toast({ title: t('Report exported'), description: t('The compliance report CSV has been downloaded.') });
    } catch (error: any) {
      toast({ variant: 'destructive', title: t('Export failed'), description: error.message ?? t('Could not export the report.') });
    } finally {
      setBusy(false);
    }
  };

  const handleTraceabilityExport = async (format: 'csv' | 'xlsx') => {
    if (!token) return;
    setBusy(true);
    try {
      await downloadWorkerTraceability(token, format);
      toast({ title: t('Worker report exported'), description: t(`${format.toUpperCase()} export downloaded successfully.`) });
    } catch (error: any) {
      toast({ variant: 'destructive', title: t('Export failed'), description: error.message ?? t('Could not export worker traceability.') });
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
          <h1 className="text-3xl font-bold tracking-tight">{t('Audit & Reports')}</h1>
          <p className="text-muted-foreground">{t('The immutable activity trail and audit-ready compliance export.')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canViewAudit && <Button variant="outline" onClick={handleExport} disabled={busy}>
            <Download className="me-2 h-4 w-4" /> {t('Compliance CSV')}
          </Button>}
          <Button variant="outline" onClick={() => void handleTraceabilityExport('csv')} disabled={busy}>
            <FileText className="me-2 h-4 w-4" /> {t('Traceability CSV')}
          </Button>
          <Button onClick={() => void handleTraceabilityExport('xlsx')} disabled={busy}>
            <FileSpreadsheet className="me-2 h-4 w-4" /> {busy ? t('Exporting…') : t('Traceability Excel')}
          </Button>
        </div>
      </header>

      {loadError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
        <span>{loadError}</span><Button variant="outline" size="sm" onClick={() => void load()}>{t('Try again')}</Button>
      </div>}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" /> {t('Worker traceability')}</CardTitle>
          <CardDescription>{t('Power BI-ready worker records connecting identity, employer hierarchy, project, site, role, clearance, and expiry.')}</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? <Skeleton className="h-48 w-full" /> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>{t('National ID')}</TableHead><TableHead>{t('Worker')}</TableHead><TableHead>{t('Employer')}</TableHead>
                <TableHead>{t('Project / site')}</TableHead><TableHead>{t('Job role')}</TableHead><TableHead>{t('Current clearance')}</TableHead><TableHead>{t('Access')}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {traceability.length === 0 ? <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">{t('No project workers match your scope.')}</TableCell></TableRow> : traceability.slice(0, 100).map((row, index) => (
                  <TableRow key={`${row.nationalId}-${row.project}-${row.site}-${index}`}>
                    <TableCell className="font-mono text-xs">{row.nationalId || '—'}</TableCell>
                    <TableCell className="font-medium">{row.workerName}</TableCell>
                    <TableCell><div>{row.employer}</div>{row.mainContractor && <div className="text-xs text-muted-foreground">{t('Main contractor')}: {row.mainContractor}</div>}</TableCell>
                    <TableCell><div>{row.project || '—'}</div><div className="text-xs text-muted-foreground">{row.site || '—'}</div></TableCell>
                    <TableCell>{row.jobRole || '—'}</TableCell><TableCell>{row.clearanceStatus}</TableCell><TableCell>{t(getWorkPassStatusPresentation(row.accessStatus).label)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {canViewAudit && <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> {t('Recent audit activity')}</CardTitle>
          <CardDescription>{t('Who did what, and when — the latest 100 recorded actions.')}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('When (UTC)')}</TableHead>
                  <TableHead>{t('Action')}</TableHead>
                  <TableHead>{t('Entity')}</TableHead>
                  <TableHead>{t('Summary')}</TableHead>
                  <TableHead>{t('Actor')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">{t('No audit activity recorded.')}</TableCell></TableRow>
                ) : entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-xs">{e.occurredAtUtc.slice(0, 19).replace('T', ' ')}</TableCell>
                    <TableCell>{e.actionType}</TableCell>
                    <TableCell>{e.entityType}</TableCell>
                    <TableCell className="max-w-md whitespace-normal"><div>{e.displaySummary ?? e.summary}</div>{e.metadataJson && <details className="mt-1 text-xs text-muted-foreground"><summary className="cursor-pointer">Change details</summary><pre className="mt-2 max-w-lg overflow-auto whitespace-pre-wrap">{formatAuditDetails(e.metadataJson)}</pre></details>}</TableCell>
                    <TableCell className="text-muted-foreground"><div>{e.actorName ?? 'System'}</div><div className="text-xs">{e.actorRole ?? '—'}</div></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>}
    </div>
  );
}
