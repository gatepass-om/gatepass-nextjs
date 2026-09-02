'use client';

import { FormEvent, useEffect, useState } from 'react';
import { BadgeCheck, ClipboardCheck, DoorOpen, ScanLine, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useAuthProtection } from '@/hooks/use-auth-protection';
import { useSession } from '@/providers/session-provider';
import { useToast } from '@/hooks/use-toast';
import { ScannerPreview } from '@/components/scan/scanner-preview';
import { createGateActivityRequest, createInspectionRequest, listSitesRequest, resolvePersonnelScanRequest, type PersonnelScanStatus } from '@/lib/api';
import type { Site } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

  const canInspect = inspectionRoles.includes(user?.role ?? '');
  const canRecordGateActivity = user?.role === 'Admin' || user?.role === 'Security';

  useEffect(() => {
    if (!token) return;
    void listSitesRequest(token).then((rows) => {
      setSites(rows);
      setSiteId((current) => current || rows[0]?.id || '');
    }).catch(() => undefined);
  }, [token]);

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

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Personnel Scan</h1>
        <p className="text-muted-foreground">Scan a live QR or printed badge to check identity, access eligibility, and inspection history at the selected site.</p>
      </header>

      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>One scan, role-appropriate action</AlertTitle>
        <AlertDescription>Managers can review the live result and start an inspection. Only Security and Admin can record entry or exit.</AlertDescription>
      </Alert>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ScanLine className="h-5 w-5" /> Scan credential</CardTitle>
            <CardDescription>Use a current phone QR or the QR printed on an issued badge.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="scan-site">Site</Label>
              <Select value={siteId} onValueChange={setSiteId}>
                <SelectTrigger id="scan-site"><SelectValue placeholder="Choose a site" /></SelectTrigger>
                <SelectContent>{sites.map((site) => <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <ScannerPreview isPaused={busy || !siteId} onScanSuccess={(value) => void resolve(value)} />
            <form className="flex gap-2" onSubmit={submitScan}>
              <Input aria-label="Live QR or printed badge credential" value={credential} onChange={(event) => setCredential(event.target.value)} placeholder="Scan or paste credential" />
              <Button type="submit" disabled={busy || !siteId || !credential.trim()}>Resolve</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BadgeCheck className="h-5 w-5" /> Live result</CardTitle>
            <CardDescription>The decision is evaluated when the credential is scanned, not when the badge is printed.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {!result ? <p className="text-sm text-muted-foreground">Scan a worker credential to see their identity and live eligibility.</p> : <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
                <div>
                  <p className="font-semibold">{result.name}</p>
                  <p className="text-sm text-muted-foreground">{[result.workerCode, result.workerProfile?.jobTitle, result.workerProfile?.employerName].filter(Boolean).join(' · ')}</p>
                </div>
                <Badge variant={permitted ? 'default' : 'destructive'} className="gap-1">
                  {permitted ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
                  {permitted ? 'Eligible at this site' : 'Not eligible'}
                </Badge>
              </div>

              <dl className="grid gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
                <div><dt className="text-muted-foreground">Site</dt><dd className="font-medium">{result.siteName}</dd></div>
                <div><dt className="text-muted-foreground">Presence</dt><dd className="font-medium">{result.presenceStatus}</dd></div>
                <div><dt className="text-muted-foreground">Access request</dt><dd className="font-medium">{result.hasApprovedAccess ? 'Approved' : 'Not approved'}</dd></div>
                <div><dt className="text-muted-foreground">Work pass</dt><dd className="font-medium">{result.activeWorkPass?.passNumber ?? 'None active'}</dd></div>
              </dl>

              {result.failureReason ? <Alert variant="destructive"><ShieldAlert className="h-4 w-4" /><AlertTitle>Access blocked</AlertTitle><AlertDescription>{result.failureReason}</AlertDescription></Alert> : null}
              {result.missingCertificates.length > 0 ? <Alert variant="destructive"><ShieldAlert className="h-4 w-4" /><AlertDescription>Missing credentials: {result.missingCertificates.join(', ')}</AlertDescription></Alert> : null}

              {canRecordGateActivity ? <div className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center gap-2"><DoorOpen className="h-4 w-4" /><p className="font-medium">Gate movement</p></div>
                <Input value={gateName} onChange={(event) => setGateName(event.target.value)} aria-label="Checkpoint name" />
                <div className="flex flex-wrap gap-2">
                  <Button disabled={busy || !result.canCheckIn} onClick={() => void recordGateActivity('CheckIn')}>Record entry</Button>
                  <Button variant="outline" disabled={busy || !result.canCheckOut} onClick={() => void recordGateActivity('CheckOut')}>Record exit</Button>
                </div>
              </div> : null}

              {canInspect ? <div className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2"><ClipboardCheck className="h-4 w-4" /><p className="font-medium">Inspection</p></div>
                  {!inspectionOpen ? <Button variant="outline" disabled={busy} onClick={() => { setInspectionOutcome(null); setInspectionOpen(true); }}>Start inspection</Button> : null}
                </div>
                {inspectionOpen ? <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Inspection findings do not change access unless a configured policy says so.</p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant={inspectionOutcome === 'Compliant' ? 'default' : 'outline'} onClick={() => setInspectionOutcome('Compliant')}>Compliant</Button>
                    <Button type="button" variant={inspectionOutcome === 'NonCompliant' ? 'destructive' : 'outline'} onClick={() => setInspectionOutcome('NonCompliant')}>Non-compliant</Button>
                  </div>
                  {inspectionOutcome === 'NonCompliant' ? <Input value={inspectionReason} onChange={(event) => setInspectionReason(event.target.value)} placeholder="Finding, e.g. PPE violation" aria-label="Inspection finding" /> : null}
                  <Textarea value={inspectionNotes} onChange={(event) => setInspectionNotes(event.target.value)} placeholder="Notes (optional)" aria-label="Inspection notes" />
                  <div className="flex gap-2"><Button disabled={busy || !inspectionOutcome} onClick={() => void recordInspection()}>Submit inspection</Button><Button variant="ghost" disabled={busy} onClick={() => setInspectionOpen(false)}>Cancel</Button></div>
                </div> : null}
              </div> : null}
            </>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
