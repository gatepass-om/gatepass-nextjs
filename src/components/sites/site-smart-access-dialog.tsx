'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DoorOpen, Lock, Plus, ScanLine, KeyRound } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/providers/session-provider';
import {
  getSiteSmartAccessRequest,
  createSiteEntranceRequest,
  assignDeviceToSiteRequest,
  provisionSiteCredentialsRequest,
  type SiteSmartAccess,
} from '@/lib/api';

const ACCESS_POINT_TYPES: { value: number; label: string }[] = [
  { value: 1, label: 'Gate' },
  { value: 2, label: 'Door' },
  { value: 5, label: 'Turnstile' },
  { value: 6, label: 'Barrier' },
  { value: 7, label: 'Other' },
];

const typeLabel = (t: number) => ACCESS_POINT_TYPES.find((x) => x.value === t)?.label ?? 'Entrance';

export function SiteSmartAccessDialog({
  siteId,
  siteName,
  open,
  onOpenChange,
}: {
  siteId: string;
  siteName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { token } = useSession();
  const { toast } = useToast();
  const [data, setData] = useState<SiteSmartAccess | null>(null);
  const [loading, setLoading] = useState(false);
  const [newEntranceName, setNewEntranceName] = useState('');
  const [newEntranceType, setNewEntranceType] = useState('1');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setData(await getSiteSmartAccessRequest(token, siteId));
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Load failed', description: error.message ?? 'Could not load smart access.' });
    } finally {
      setLoading(false);
    }
  }, [token, siteId, toast]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const addEntrance = async () => {
    if (!token || !newEntranceName.trim()) return;
    setBusy(true);
    try {
      await createSiteEntranceRequest(token, siteId, {
        name: newEntranceName.trim(),
        accessPointType: Number(newEntranceType),
        supportsEntry: true,
      });
      setNewEntranceName('');
      toast({ title: 'Entrance added', description: `"${newEntranceName.trim()}" created.` });
      await load();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Failed', description: error.message ?? 'Could not add entrance.' });
    } finally {
      setBusy(false);
    }
  };

  const assign = async (deviceId: string, entranceId: string | null) => {
    if (!token) return;
    setBusy(true);
    try {
      await assignDeviceToSiteRequest(token, siteId, { deviceId, entranceId });
      await load();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Failed', description: error.message ?? 'Could not assign device.' });
    } finally {
      setBusy(false);
    }
  };

  const provision = async () => {
    if (!token) return;
    setBusy(true);
    try {
      const result = await provisionSiteCredentialsRequest(token, siteId);
      toast({
        title: 'Credentials provisioned',
        description: `${result.provisioned} of ${result.approvedRequests} access requests provisioned${result.failed ? `, ${result.failed} failed` : ''}.`,
      });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Failed', description: error.message ?? 'Could not provision credentials.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DoorOpen className="h-5 w-5" /> Smart access — {siteName}
          </DialogTitle>
          <DialogDescription>Manage this site&apos;s entrances, the locks mounted at each, and lock credentials.</DialogDescription>
        </DialogHeader>

        {loading && <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>}

        {!loading && data && !data.hasSmartAccessConfigured && (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <ScanLine className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
            <p className="font-medium">No smart-access provider configured</p>
            <p className="text-sm text-muted-foreground mt-1">
              This site uses badge verification only. Configure a smart-access provider to manage electronic locks here.
            </p>
          </div>
        )}

        {!loading && data && data.hasSmartAccessConfigured && (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                {data.providers.length} provider{data.providers.length === 1 ? '' : 's'} · {data.entrances.length} entrance{data.entrances.length === 1 ? '' : 's'}
              </p>
              <Button size="sm" variant="secondary" onClick={provision} disabled={busy}>
                <KeyRound className="mr-2 h-4 w-4" /> Provision credentials
              </Button>
            </div>

            {/* Entrances with their locks */}
            <div className="space-y-3">
              {data.entrances.map((e) => (
                <div key={e.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DoorOpen className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{e.name}</span>
                      <Badge variant="outline">{typeLabel(e.accessPointType)}</Badge>
                      {e.supportsEntry && <Badge variant="secondary">Entry</Badge>}
                      {e.supportsExit && <Badge variant="secondary">Exit</Badge>}
                    </div>
                    <span className="text-xs text-muted-foreground">{e.locks.length} lock{e.locks.length === 1 ? '' : 's'}</span>
                  </div>
                  {e.locks.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {e.locks.map((l) => (
                        <span key={l.id} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs">
                          <Lock className="h-3 w-3" /> {l.name}
                          <button className="ml-1 text-muted-foreground hover:text-destructive" onClick={() => assign(l.id, null)} disabled={busy} title="Detach">×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Add entrance */}
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input placeholder="New entrance name (e.g. Contractor Gate)" value={newEntranceName} onChange={(ev) => setNewEntranceName(ev.target.value)} />
              </div>
              <Select value={newEntranceType} onValueChange={setNewEntranceType}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACCESS_POINT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={String(t.value)}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={addEntrance} disabled={busy || !newEntranceName.trim()}>
                <Plus className="mr-2 h-4 w-4" /> Entrance
              </Button>
            </div>

            {/* Unassigned devices */}
            {data.unassignedDevices.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-sm font-medium mb-2">Unassigned locks ({data.unassignedDevices.length})</p>
                  <div className="space-y-2">
                    {data.unassignedDevices.map((d) => (
                      <div key={d.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                        <span className="inline-flex items-center gap-2 text-sm">
                          <Lock className="h-4 w-4 text-muted-foreground" /> {d.name}
                          <span className="text-xs text-muted-foreground">{d.model}</span>
                        </span>
                        <Select onValueChange={(entranceId) => assign(d.id, entranceId)} disabled={busy || data.entrances.length === 0}>
                          <SelectTrigger className="w-44"><SelectValue placeholder={data.entrances.length ? 'Assign to entrance…' : 'Add an entrance first'} /></SelectTrigger>
                          <SelectContent>
                            {data.entrances.map((e) => (
                              <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
