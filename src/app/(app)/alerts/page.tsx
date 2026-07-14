'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BellRing, RefreshCw, ShieldAlert, Siren } from 'lucide-react';
import { useAuthProtection } from '@/hooks/use-auth-protection';
import { useSession } from '@/providers/session-provider';
import { useToast } from '@/hooks/use-toast';
import { usePolling } from '@/lib/polling';
import { useLiveEvents } from '@/hooks/use-live-events';
import { acknowledgeAlert, fetchAlerts, listSitesRequest, type SiteAlert } from '@/lib/api';
import type { Site } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SummaryCard, EmptyRow } from '@/components/smart-access/common';
import { AcknowledgeAlertDialog } from '@/components/alerts/acknowledge-dialog';

const severityClass: Record<string, string> = {
  Critical: 'bg-danger/15 text-danger border-danger/30',
  High: 'bg-warning/15 text-warning border-warning/30',
  Medium: 'bg-primary/15 text-primary border-primary/30',
  Low: 'bg-muted text-muted-foreground border-border',
};

function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span className={`inline-block rounded-md border px-2 py-0.5 text-xs font-semibold ${severityClass[severity] ?? severityClass.Low}`}>
      {severity}
    </span>
  );
}

export default function AlertsPage() {
  const { currentUser, loading: authLoading, isAuthorized, UnauthorizedComponent } = useAuthProtection([
    'Admin', 'Operator Admin', 'Manager', 'Security',
  ]);
  const { token } = useSession();
  const { toast } = useToast();
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState('all');
  const [unacknowledgedOnly, setUnacknowledgedOnly] = useState(false);
  const [alerts, setAlerts] = useState<SiteAlert[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [busy, setBusy] = useState(false);
  const siteFilter = selectedSiteId === 'all' ? undefined : selectedSiteId;

  const fetchData = useCallback(async (opts?: { silent?: boolean }) => {
    if (!token || !currentUser) return;
    if (!opts?.silent) setLoadingData(true);
    try {
      const sitesInput = currentUser.role === 'Operator Admin' && currentUser.operatorId
        ? { operatorId: currentUser.operatorId }
        : undefined;
      const [siteRows, alertRows] = await Promise.all([
        listSitesRequest(token, sitesInput),
        fetchAlerts(token, { siteId: siteFilter, unacknowledgedOnly }),
      ]);
      setSites((siteRows as any[]).map((site) => ({
        id: site.id, name: site.name, operatorId: site.operator?.id ?? site.operatorId ?? '',
        managerIds: site.managerIds ?? [], requiredCertificates: site.requiredCertificates ?? [],
      })));
      setAlerts(alertRows);
    } catch (error: any) {
      console.error('Failed to load alerts', error);
      toast({ variant: 'destructive', title: 'Alerts Load Failed', description: error.message || 'Could not load site alerts.' });
    } finally {
      if (!opts?.silent) setLoadingData(false);
    }
  }, [currentUser, siteFilter, unacknowledgedOnly, toast, token]);

  useEffect(() => { void fetchData(); }, [fetchData]);
  // Live: an alert raised or acknowledged anywhere in scope refreshes the table instantly (silent so the Refresh
  // button and empty-state label don't flicker). Polling stays as a slow safety net.
  useLiveEvents(useCallback((event) => {
    if (event.type === 'SiteAlertRaised' || event.type === 'NotificationDispatched') {
      void fetchData({ silent: true });
    }
  }, [fetchData]));
  usePolling(() => { void fetchData({ silent: true }); }, 45000);

  const unacknowledgedCount = useMemo(() => alerts.filter((a) => !a.isAcknowledged).length, [alerts]);
  const criticalCount = useMemo(() => alerts.filter((a) => a.severity === 'Critical' && !a.isAcknowledged).length, [alerts]);

  const handleAcknowledge = async (alertId: string, note: string): Promise<boolean> => {
    if (!token) return false;
    setBusy(true);
    try {
      await acknowledgeAlert(token, alertId, note || undefined);
      toast({ title: 'Alert Acknowledged', description: 'The alert has been marked as handled.' });
      await fetchData();
      return true;
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Acknowledge Failed', description: error.message || 'Could not acknowledge alert.' });
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (authLoading || !currentUser) return <div>Loading...</div>;
  if (!isAuthorized) return <UnauthorizedComponent />;

  return (
    <div className="space-y-4 md:space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Alerts</h1>
          <p className="text-muted-foreground">Site security alerts — intrusion, tamper, device and lone-worker events — with acknowledgement.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
            <SelectTrigger className="w-full sm:w-[240px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sites</SelectItem>
              {sites.map((site) => <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button
            variant={unacknowledgedOnly ? 'default' : 'outline'}
            onClick={() => setUnacknowledgedOnly((value) => !value)}
          >
            <BellRing className="mr-2 h-4 w-4" />
            {unacknowledgedOnly ? 'Unacknowledged' : 'All statuses'}
          </Button>
          <Button variant="outline" disabled={loadingData} onClick={() => void fetchData()}>
            <RefreshCw className="mr-2 h-4 w-4" />Refresh
          </Button>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard icon={ShieldAlert} label="Total Alerts" value={alerts.length} />
        <SummaryCard icon={BellRing} label="Unacknowledged" value={unacknowledgedCount} />
        <SummaryCard icon={Siren} label="Critical Unacknowledged" value={criticalCount} />
      </div>

      <Card className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Severity</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Site</TableHead>
              <TableHead className="hidden md:table-cell">Description</TableHead>
              <TableHead className="hidden lg:table-cell">Occurred (UTC)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {alerts.length === 0 ? (
              <EmptyRow colSpan={7} label={loadingData ? 'Loading alerts…' : 'No alerts to display.'} />
            ) : (
              alerts.map((alert) => (
                <TableRow key={alert.id} className={alert.isAcknowledged ? 'opacity-60' : undefined}>
                  <TableCell><SeverityBadge severity={alert.severity} /></TableCell>
                  <TableCell className="font-medium">{alert.eventType}</TableCell>
                  <TableCell>{alert.siteName}</TableCell>
                  <TableCell className="hidden max-w-[420px] truncate md:table-cell" title={alert.description}>{alert.description}</TableCell>
                  <TableCell className="hidden whitespace-nowrap text-muted-foreground lg:table-cell">{new Date(alert.occurredAtUtc).toLocaleString()}</TableCell>
                  <TableCell>
                    {alert.isAcknowledged
                      ? <span className="text-xs text-success">Acknowledged{alert.acknowledgedByUserName ? ` · ${alert.acknowledgedByUserName}` : ''}</span>
                      : <span className="inline-flex items-center gap-1 text-xs text-warning"><AlertTriangle className="h-3 w-3" />Open</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    {alert.isAcknowledged
                      ? <span className="text-xs text-muted-foreground">—</span>
                      : <AcknowledgeAlertDialog alert={alert} busy={busy} onAcknowledge={handleAcknowledge} />}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
