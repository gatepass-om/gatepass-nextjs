'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Download, LogOut, RefreshCw, Users } from 'lucide-react';
import { useAuthProtection } from '@/hooks/use-auth-protection';
import { useSession } from '@/providers/session-provider';
import { useToast } from '@/hooks/use-toast';
import { usePolling } from '@/lib/polling';
import { useLiveEvents } from '@/hooks/use-live-events';
import { listSitesRequest } from '@/lib/api';
import type { Site } from '@/lib/types';
import {
  type MusterEventDetail,
  type MusterEventSummary,
  type MusterRecord,
  type MusterRecordState,
  checkOffMusterRecord,
  closeMuster,
  getMuster,
  initiateMuster,
  listMusters,
} from '@/lib/muster-api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SummaryCard } from '@/components/smart-access/common';
import { InitiateMusterDialog } from '@/components/muster/initiate-muster-dialog';

const STATES: MusterRecordState[] = ['Accounted', 'Unaccounted', 'Evacuated'];

function csvCell(value: unknown) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function activeStateClass(state: MusterRecordState, target: MusterRecordState) {
  if (state !== target) return '';
  if (target === 'Accounted') return 'bg-success text-white hover:bg-success/90';
  if (target === 'Evacuated') return 'bg-primary text-white hover:bg-primary/90';
  return 'bg-warning text-white hover:bg-warning/90';
}

export default function MusterPage() {
  const { currentUser, loading: authLoading, isAuthorized, UnauthorizedComponent } = useAuthProtection([
    'Admin', 'Operator Admin', 'Manager', 'Security',
  ]);
  const { token } = useSession();
  const { toast } = useToast();
  const [sites, setSites] = useState<Site[]>([]);
  const [musters, setMusters] = useState<MusterEventSummary[]>([]);
  const [selectedMusterId, setSelectedMusterId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MusterEventDetail | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [busy, setBusy] = useState(false);
  const [unaccountedOnly, setUnaccountedOnly] = useState(false);
  // Monotonic request token so a slow background poll can never overwrite a newer detail load (last-request-wins).
  const detailReqSeq = useRef(0);

  const loadList = useCallback(async () => {
    if (!token || !currentUser) return;
    try {
      const sitesInput = currentUser.role === 'Operator Admin' && currentUser.operatorId
        ? { operatorId: currentUser.operatorId }
        : undefined;
      const [siteRows, musterRows] = await Promise.all([
        listSitesRequest(token, sitesInput),
        listMusters(token),
      ]);
      setSites((siteRows as any[]).map((site) => ({
        id: site.id, name: site.name, operatorId: site.operator?.id ?? site.operatorId ?? '',
        managerIds: site.managerIds ?? [], requiredCertificates: site.requiredCertificates ?? [],
      })));
      setMusters(musterRows);
      setSelectedMusterId((current) => current ?? musterRows.find((m) => m.status === 'Active')?.id ?? musterRows[0]?.id ?? null);
    } catch (error: any) {
      console.error('Failed to load musters', error);
      toast({ variant: 'destructive', title: 'Muster Load Failed', description: error.message || 'Could not load musters.' });
    }
  }, [token, currentUser, toast]);

  const loadDetail = useCallback(async (id: string, opts?: { userInitiated?: boolean }) => {
    if (!token) return;
    const seq = ++detailReqSeq.current;
    try {
      const next = await getMuster(token, id);
      // Only the most recent request may write detail — a stale poll resolving after a mutation can't revert it.
      if (seq === detailReqSeq.current) setDetail(next);
    } catch (error: any) {
      console.error('Failed to load muster detail', error);
      if (seq === detailReqSeq.current && opts?.userInitiated) {
        // Don't keep showing a different muster's roster than the one selected in the header.
        setDetail(null);
        toast({ variant: 'destructive', title: 'Muster Load Failed', description: error.message || 'Could not load the selected muster.' });
      }
    }
  }, [token, toast]);

  useEffect(() => { void loadList().finally(() => setLoadingData(false)); }, [loadList]);
  useEffect(() => {
    if (!selectedMusterId) return;
    // Drop a previously-shown muster's data while loading a different one (keep it if we're already showing this id).
    setDetail((prev) => (prev && prev.id === selectedMusterId ? prev : null));
    void loadDetail(selectedMusterId, { userInitiated: true });
  }, [selectedMusterId, loadDetail]);
  // Live: a check-off / initiation / close anywhere refreshes the roll-call immediately. Muster is safety-critical,
  // so the polling fallback stays comparatively tight (15s) in case the stream is unavailable mid-evacuation.
  useLiveEvents(useCallback((event) => {
    if (event.type === 'MusterChanged') {
      void loadList();
      if (selectedMusterId) void loadDetail(selectedMusterId);
    }
  }, [loadList, loadDetail, selectedMusterId]));
  usePolling(() => {
    void loadList();
    if (selectedMusterId) void loadDetail(selectedMusterId);
  }, 15000);

  const handleInitiate = async (input: { siteId: string; reason?: string }): Promise<boolean> => {
    if (!token) return false;
    setBusy(true);
    try {
      const created = await initiateMuster(token, input);
      setSelectedMusterId(created.id);
      setDetail(created);
      await loadList();
      toast({ title: 'Muster Initiated', description: `Roll-call started with ${created.expectedHeadcount} on-site personnel.` });
      return true;
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Muster Failed', description: error.message || 'Could not initiate muster.' });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleCheckOff = async (record: MusterRecord, state: MusterRecordState) => {
    if (!token || !detail) return;
    setBusy(true);
    try {
      await checkOffMusterRecord(token, detail.id, record.id, { state });
      await loadDetail(detail.id);
      await loadList();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Check-off Failed', description: error.message || 'Could not update roll-call.' });
    } finally {
      setBusy(false);
    }
  };

  const handleClose = async () => {
    if (!token || !detail) return;
    setBusy(true);
    try {
      await closeMuster(token, detail.id);
      toast({ title: 'Muster Closed', description: 'The roll-call has been closed out.' });
      await loadDetail(detail.id);
      await loadList();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Close Failed', description: error.message || 'Could not close muster.' });
    } finally {
      setBusy(false);
    }
  };

  const handleExport = () => {
    if (!detail) return;
    const header = ['Name', 'WorkerCode', 'Company', 'State', 'LastGate', 'LastSeenUtc', 'LastZone', 'Note'];
    const rows = detail.records.map((r) => [r.userName, r.workerCode ?? '', r.companyName ?? '', r.state, r.lastGateName ?? '', r.lastSeenAtUtc ?? '', r.lastKnownZoneName ?? '', r.note ?? '']);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `muster-${detail.siteName.replace(/\s+/g, '-')}-${detail.id.slice(0, 8)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (authLoading || !currentUser) return <div>Loading...</div>;
  if (!isAuthorized) return <UnauthorizedComponent />;

  const isActive = detail?.status === 'Active';
  const visibleRecords = detail
    ? (unaccountedOnly ? detail.records.filter((r) => r.state === 'Unaccounted') : detail.records)
    : [];

  return (
    <div className="space-y-4 md:space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Muster / Roll-Call</h1>
          <p className="text-muted-foreground">Emergency evacuation accounting — snapshot on-site personnel and confirm everyone is safe.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {musters.length > 0 && (
            <Select value={selectedMusterId ?? undefined} onValueChange={setSelectedMusterId}>
              <SelectTrigger className="w-full sm:w-[280px]"><SelectValue placeholder="Select a muster" /></SelectTrigger>
              <SelectContent>
                {musters.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.siteName} · {m.status} · {new Date(m.initiatedAtUtc).toLocaleString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" disabled={loadingData} onClick={() => void loadList()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
          <InitiateMusterDialog sites={sites} busy={busy} onInitiate={handleInitiate} />
        </div>
      </header>

      {!detail ? (
        <Card className="flex h-48 items-center justify-center text-center text-muted-foreground">
          {loadingData ? 'Loading musters…' : 'No active muster. Initiate one to begin an evacuation roll-call.'}
        </Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-4">
            <div className="ops-panel flex flex-col justify-between p-5 lg:col-span-1">
              <div className="flex items-center gap-2">
                {isActive && <span className="status-dot status-dot--live" aria-hidden="true" />}
                <span className="eyebrow">Unaccounted</span>
              </div>
              <div className={`metric-value ${detail.unaccountedCount > 0 ? 'text-danger' : 'text-success'}`}>{detail.unaccountedCount}</div>
              <div className="text-xs text-muted-foreground">{detail.siteName} · {detail.status}{detail.reason ? ` · ${detail.reason}` : ''}</div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3 lg:col-span-3">
              <SummaryCard icon={Users} label="Expected" value={detail.expectedHeadcount} />
              <SummaryCard icon={CheckCircle2} label="Accounted" value={detail.accountedCount} />
              <SummaryCard icon={LogOut} label="Evacuated" value={detail.evacuatedCount} />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              variant={unaccountedOnly ? 'default' : 'outline'}
              size="sm"
              onClick={() => setUnaccountedOnly((value) => !value)}
            >
              {unaccountedOnly ? 'Showing unaccounted' : 'Show all'}
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled={detail.records.length === 0} onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" />Export manifest
              </Button>
              {isActive && (
                <Button variant="secondary" size="sm" disabled={busy} onClick={() => void handleClose()}>
                  Close muster
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleRecords.length === 0 ? (
              <Card className="flex h-24 items-center justify-center text-center text-muted-foreground md:col-span-2 xl:col-span-3">
                {unaccountedOnly ? 'Everyone is accounted for.' : 'No personnel were on-site when this muster started.'}
              </Card>
            ) : (
              visibleRecords.map((record) => (
                <Card key={record.id} className="space-y-3 p-4">
                  <div>
                    <div className="font-semibold text-foreground">{record.userName}</div>
                    <div className="text-xs text-muted-foreground">
                      {record.workerCode ?? '—'}{record.companyName ? ` · ${record.companyName}` : ''}
                    </div>
                  </div>
                  <div className="space-y-0.5 text-xs text-muted-foreground">
                    <div>Last gate: {record.lastGateName ?? '—'}</div>
                    <div>Last seen: {record.lastSeenAtUtc ? new Date(record.lastSeenAtUtc).toLocaleString() : '—'}</div>
                    {record.lastKnownZoneName && <div>Zone: {record.lastKnownZoneName}</div>}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {STATES.map((state) => (
                      <Button
                        key={state}
                        size="sm"
                        variant={record.state === state ? 'default' : 'outline'}
                        className={`text-xs ${activeStateClass(record.state, state)}`}
                        disabled={busy || !isActive}
                        onClick={() => void handleCheckOff(record, state)}
                      >
                        {state}
                      </Button>
                    ))}
                  </div>
                </Card>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
