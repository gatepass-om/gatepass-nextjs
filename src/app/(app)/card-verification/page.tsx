'use client';

import { FormEvent, useEffect, useState } from 'react';
import { CreditCard, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useAuthProtection } from '@/hooks/use-auth-protection';
import { useSession } from '@/providers/session-provider';
import { useToast } from '@/hooks/use-toast';
import { ScannerPreview } from '@/components/scan/scanner-preview';
import {
  getWorkerCardOfflineManifest,
  listSitesRequest,
  validateWorkerCard,
  type WorkerCardValidation,
} from '@/lib/api';
import type { Site } from '@/lib/types';
import {
  cacheWorkerCardOfflineManifest,
  readWorkerCardOfflineManifest,
  verifyWorkerCardOffline,
} from '@/lib/worker-card-offline';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function CardVerificationPage() {
  const { loading, isAuthorized, UnauthorizedComponent } = useAuthProtection([
    'Admin',
    'Operator Admin',
    'Manager',
    'Security',
    'Contractor Admin',
  ]);
  const { token } = useSession();
  const { toast } = useToast();
  const [credential, setCredential] = useState('');
  const [result, setResult] = useState<WorkerCardValidation | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [siteId, setSiteId] = useState('');
  const [offlineStatus, setOfflineStatus] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    void listSitesRequest(token).then(rows => {
      setSites(rows);
      setSiteId(current => current || rows[0]?.id || '');
    }).catch(() => undefined);
  }, [token]);

  const refreshOfflineManifest = async () => {
    if (!token || !siteId) return;
    setBusy(true);
    try {
      const manifest = await getWorkerCardOfflineManifest(token, siteId);
      cacheWorkerCardOfflineManifest(manifest);
      setOfflineStatus(
        `Offline identity list ready until ${new Date(manifest.expiresAtUtc).toLocaleTimeString()}.`,
      );
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Offline list refresh failed',
        description: error.message ?? 'The offline identity list could not be refreshed.',
      });
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value: string) => {
    if (!token || !value.trim()) return;
    setBusy(true);
    try {
      setResult(await validateWorkerCard(token, value.trim()));
      setOfflineStatus('');
    } catch (error: any) {
      const manifest = siteId ? readWorkerCardOfflineManifest(siteId) : null;
      if (!manifest) {
        setResult(null);
        toast({
          variant: 'destructive',
          title: 'Verification failed',
          description: error.message ?? 'The card could not be checked.',
        });
      } else {
        const offline = await verifyWorkerCardOffline(value.trim(), manifest);
        if (offline.kind === 'identity-match') {
          setResult({
            isValid: true,
            reason: 'Offline identity match. Entry authorization was not evaluated and is not granted.',
            card: {
              id: `offline-${offline.entry.cardNumber}`,
              cardNumber: offline.entry.cardNumber,
              workerId: offline.entry.workerId,
              workerCode: offline.entry.workerCode,
              workerName: offline.entry.workerName,
              employerName: offline.entry.employerName,
              jobTitle: offline.entry.jobTitle,
              role: offline.entry.role,
              status: 'Issued',
              isValid: true,
              credential: '',
              photoCropX: 0.5,
              photoCropY: 0.5,
              photoZoom: 1,
              issuedAtUtc: manifest.generatedAtUtc,
              expiresAtUtc: offline.entry.expiresAtUtc,
            },
          });
          setOfflineStatus('Offline identity match. Authorization remains unknown and must be checked online.');
        } else {
          setResult({
            isValid: false,
            reason: offline.kind === 'manifest-expired'
              ? 'The offline identity list has expired. Reconnect and refresh it.'
              : 'No valid identity match exists in the current offline list.',
          });
          setOfflineStatus('Offline verification did not establish a current identity.');
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void verify(credential);
  };

  if (loading) return <p>Loading…</p>;
  if (!isAuthorized) return <UnauthorizedComponent />;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Worker Card Verification</h1>
        <p className="text-muted-foreground">
          Permanent-card identity verification for guarded, compliance-only, and open-area operations.
        </p>
      </header>

      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Identity verification only</AlertTitle>
        <AlertDescription>
          A valid worker card confirms the current card and worker identity. It does not authorize entry.
          Guarded or smart-access sites must still run their configured live access decision.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Offline identity continuity</CardTitle>
          <CardDescription>
            Cache a short-lived, revocation-aware identity list for one site before connectivity is lost.
            Offline matches never grant access.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Select value={siteId} onValueChange={setSiteId}>
            <SelectTrigger className="w-[280px]" aria-label="Offline manifest site">
              <SelectValue placeholder="Choose a site" />
            </SelectTrigger>
            <SelectContent>
              {sites.map(site => <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            disabled={busy || !siteId}
            onClick={() => void refreshOfflineManifest()}
          >
            Refresh offline identity list
          </Button>
          {offlineStatus && <p className="text-sm text-muted-foreground">{offlineStatus}</p>}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Scan permanent card</CardTitle>
            <CardDescription>Scan a QR beginning with gpc_ or paste the credential below.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ScannerPreview
              isPaused={busy}
              onScanSuccess={(value) => {
                setCredential(value);
                void verify(value);
              }}
            />
            <form className="flex gap-2" onSubmit={submit}>
              <Input
                aria-label="Worker card credential"
                value={credential}
                onChange={event => setCredential(event.target.value)}
                placeholder="gpc_..."
              />
              <Button type="submit" disabled={busy || !credential.trim()}>Verify</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Verification result
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!result ? (
              <p className="text-sm text-muted-foreground">Scan a card to display its live identity status.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className={result.isValid ? 'h-5 w-5 text-emerald-600' : 'h-5 w-5 text-destructive'} />
                  <Badge variant={result.isValid ? 'default' : 'destructive'}>
                    {result.isValid ? 'Valid identity card' : 'Invalid card'}
                  </Badge>
                </div>
                <p className="text-sm">{result.reason}</p>
                {result.card && (
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
                    <dt className="font-medium">Worker</dt><dd>{result.card.workerName}</dd>
                    <dt className="font-medium">Worker ID</dt><dd>{result.card.workerCode}</dd>
                    <dt className="font-medium">Company</dt><dd>{result.card.employerName}</dd>
                    <dt className="font-medium">Role</dt><dd>{result.card.jobTitle}</dd>
                    <dt className="font-medium">Card</dt><dd>{result.card.cardNumber}</dd>
                    <dt className="font-medium">Status</dt><dd>{result.card.status}</dd>
                  </dl>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
