'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { useAuthProtection } from '@/hooks/use-auth-protection';
import { useSession } from '@/providers/session-provider';
import { useToast } from '@/hooks/use-toast';
import { ScannerPreview } from '@/components/scan/scanner-preview';
import { WorkerCertificationView } from '@/components/workers/worker-certification-view';
import { createGateActivityRequest, createInspectionRequest, listSitesRequest, resolvePersonnelScanRequest, type PersonnelScanStatus } from '@/lib/api';
import type { Site } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const inspectionRoles = ['Admin', 'Manager', 'Security', 'Supervisor', 'Inspector'];

export default function PersonnelScanPage() {
  const { loading, isAuthorized, UnauthorizedComponent } = useAuthProtection(['Admin', 'Manager', 'Security', 'Supervisor', 'Inspector']);
  const { token, user } = useSession();
  const { toast } = useToast();
  const [credential, setCredential] = useState('');
  const [result, setResult] = useState<PersonnelScanStatus | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [siteId, setSiteId] = useState('');
  const [busy, setBusy] = useState(false);
  const [inspectionOpen, setInspectionOpen] = useState(false);
  const [inspectionOutcome, setInspectionOutcome] = useState<'Compliant' | 'NonCompliant' | null>(null);
  const [inspectionReason, setInspectionReason] = useState('');
  const [inspectionNotes, setInspectionNotes] = useState('');
  const [gateName, setGateName] = useState('Main gate');
  const resultRef = useRef<HTMLDivElement>(null);

  const canInspect = inspectionRoles.includes(user?.role ?? '');
  const canRecordGateActivity = user?.role === 'Admin' || user?.role === 'Security';

  useEffect(() => {
    if (!token) return;
    void listSitesRequest(token).then((rows) => {
      setSites(rows);
      setSiteId((current) => current || rows[0]?.id || '');
    }).catch(() => undefined);
  }, [token]);

  // On a phone the result sits below the camera; bring it into view when a scan lands.
  useEffect(() => {
    if (result && window.matchMedia('(max-width: 1279px)').matches) {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [result]);

  const resolve = async (value: string) => {
    if (!token || !siteId || !value.trim()) return;
    setBusy(true);
    setInspectionOpen(false);
    try {
      const scan = await resolvePersonnelScanRequest(token, { credential: value.trim(), siteId });
      setResult(scan);
      setCredential(value.trim());
    } catch (error: any) {
      setResult(null);
      toast({ variant: 'destructive', title: 'Scan could not be resolved', description: error.message ?? 'Use a current live QR or an issued printed badge.' });
    } finally {
      setBusy(false);
    }
  };

  const submitScan = (event: FormEvent) => {
    event.preventDefault();
    void resolve(credential);
  };

  const recordGateActivity = async (activityType: 'CheckIn' | 'CheckOut') => {
    if (!token || !result || !gateName.trim()) return;
    setBusy(true);
    try {
      await createGateActivityRequest(token, { userId: result.userId, siteId: result.siteId, gateName: gateName.trim(), activityType });
      toast({ title: activityType === 'CheckIn' ? 'Entry recorded' : 'Exit recorded' });
      await resolve(credential);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Gate activity was not recorded', description: error.message ?? 'Review the live access result and try again.' });
    } finally {
      setBusy(false);
    }
  };

  const recordInspection = async () => {
    if (!token || !result || !inspectionOutcome) return;
    if (inspectionOutcome === 'NonCompliant' && !inspectionReason.trim()) {
      toast({ variant: 'destructive', title: 'Select or enter a finding before submitting.' });
      return;
    }
    setBusy(true);
    try {
      await createInspectionRequest(token, {
        workerId: result.userId,
        siteId: result.siteId,
        outcome: inspectionOutcome,
        wrongfulConductReason: inspectionOutcome === 'NonCompliant' ? inspectionReason.trim() : undefined,
        notes: inspectionNotes.trim() || undefined,
      });
      toast({ title: 'Inspection recorded', description: `${result.name} has a traceable inspection record.` });
      setInspectionOpen(false);
      setInspectionReason('');
      setInspectionNotes('');
      setInspectionOutcome(null);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Inspection was not recorded', description: error.message ?? 'Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p>Loading…</p>;
  if (!isAuthorized) return <UnauthorizedComponent />;
  const permitted = Boolean(result && !result.failureReason);
  const initials = result ? result.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase() : '';
  const showGateActions = canRecordGateActivity && Boolean(result && (result.canCheckIn || result.canCheckOut));

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Personnel Scan</h1>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card className="space-y-4 p-4 sm:p-5">
          <div>
            <Label htmlFor="scan-site" className="sr-only">Site</Label>
            <Select value={siteId} disabled={busy} onValueChange={(id) => { setSiteId(id); setResult(null); setInspectionOpen(false); }}>
              <SelectTrigger id="scan-site"><SelectValue placeholder="Choose a site" /></SelectTrigger>
              <SelectContent>{sites.map((site) => <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <ScannerPreview scanContext={siteId} isPaused={busy || !siteId} onScanSuccess={(value) => void resolve(value)} />
          <form className="flex gap-2" onSubmit={submitScan}>
            <Input aria-label="Live QR or printed badge credential" value={credential} onChange={(event) => setCredential(event.target.value)} placeholder="Scan or paste credential" />
            <Button type="submit" variant="outline" disabled={busy || !siteId || !credential.trim()}>Resolve</Button>
          </form>
        </Card>

        <div ref={resultRef} className="min-w-0 scroll-mt-20">
          {!result ? (
            <Card className="p-5"><p className="text-sm text-muted-foreground">Scan a badge to see the result.</p></Card>
          ) : (
            <Card className="space-y-4 p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground" aria-hidden="true">{initials}</div>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold">{result.name}</p>
                  <p className="truncate text-sm text-muted-foreground">{[result.workerCode, result.workerProfile?.jobTitle, result.workerProfile?.employerName].filter(Boolean).join(' · ')}</p>
                </div>
              </div>

              <div>
                <Badge variant={permitted ? 'success' : 'destructive'} className="gap-1.5 px-3 py-1 text-sm">
                  {permitted ? <ShieldCheck className="h-4 w-4" aria-hidden="true" /> : <ShieldAlert className="h-4 w-4" aria-hidden="true" />}
                  {permitted ? 'Cleared to enter' : 'Do not admit'}
                </Badge>
              </div>

              {result.failureReason || result.missingCertificates.length > 0 ? (
                <div role="alert" className="space-y-1 rounded-lg bg-danger-soft p-3 text-sm text-danger-ink">
                  {result.failureReason ? <p>{result.failureReason}</p> : null}
                  {result.missingCertificates.length > 0 ? <p><span>Missing credentials:</span> {result.missingCertificates.join(', ')}</p> : null}
                </div>
              ) : null}

              <dl className="divide-y text-sm">
                <div className="flex items-center justify-between gap-4 py-2.5"><dt className="text-muted-foreground">Presence</dt><dd className="font-medium">{result.presenceStatus}</dd></div>
                <div className="flex items-center justify-between gap-4 py-2.5"><dt className="text-muted-foreground">Access request</dt><dd className="font-medium">{result.hasApprovedAccess ? 'Approved' : 'Not approved'}</dd></div>
                <div className="flex items-center justify-between gap-4 py-2.5"><dt className="text-muted-foreground">Work pass</dt><dd className="font-medium">{result.activeWorkPass?.passNumber ?? 'None active'}</dd></div>
              </dl>

              <WorkerCertificationView credentials={result.credentials ?? []} checkedAt={result.credentialsCheckedAtUtc} />

              {showGateActions ? <div className="space-y-3 border-t pt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="gate-name" className="text-xs font-normal text-muted-foreground">Gate</Label>
                  <Input id="gate-name" value={gateName} onChange={(event) => setGateName(event.target.value)} aria-label="Checkpoint name" />
                </div>
                <div className="flex gap-2">
                  {result.canCheckIn ? <Button className="flex-1" disabled={busy} onClick={() => void recordGateActivity('CheckIn')}>Record entry</Button> : null}
                  {result.canCheckOut ? <Button className="flex-1" variant={result.canCheckIn ? 'outline' : 'default'} disabled={busy} onClick={() => void recordGateActivity('CheckOut')}>Record exit</Button> : null}
                </div>
              </div> : null}

              {canInspect ? <div className="border-t pt-4">
                {!inspectionOpen ? <Button className="w-full sm:w-auto" variant={showGateActions ? 'outline' : 'default'} disabled={busy} onClick={() => { setInspectionOutcome(null); setInspectionOpen(true); }}>Start inspection</Button> : <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Inspection findings do not change access unless a configured policy says so.</p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant={inspectionOutcome === 'Compliant' ? 'default' : 'outline'} onClick={() => setInspectionOutcome('Compliant')}>Compliant</Button>
                    <Button type="button" variant={inspectionOutcome === 'NonCompliant' ? 'destructive' : 'outline'} onClick={() => setInspectionOutcome('NonCompliant')}>Non-compliant</Button>
                  </div>
                  {inspectionOutcome === 'NonCompliant' ? <Input value={inspectionReason} onChange={(event) => setInspectionReason(event.target.value)} placeholder="Finding, e.g. PPE violation" aria-label="Inspection finding" /> : null}
                  <Textarea value={inspectionNotes} onChange={(event) => setInspectionNotes(event.target.value)} placeholder="Notes (optional)" aria-label="Inspection notes" />
                  <div className="flex gap-2"><Button disabled={busy || !inspectionOutcome} onClick={() => void recordInspection()}>Submit inspection</Button><Button variant="ghost" disabled={busy} onClick={() => setInspectionOpen(false)}>Cancel</Button></div>
                </div>}
              </div> : null}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
