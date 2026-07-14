'use client';

import { useEffect, useState } from 'react';
import { Loader2, Siren } from 'lucide-react';
import type { Site } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

export function InitiateMusterDialog({
  sites,
  busy,
  onInitiate,
}: {
  sites: Site[];
  busy: boolean;
  onInitiate: (input: { siteId: string; reason?: string }) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [siteId, setSiteId] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open) {
      setSiteId('');
      setReason('');
    }
  }, [open]);

  const canSubmit = !busy && Boolean(siteId);

  const submit = async () => {
    if (!siteId) return;
    const ok = await onInitiate({ siteId, reason: reason.trim() || undefined });
    if (ok) setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        <Siren className="mr-2 h-4 w-4" />
        Initiate muster
      </Button>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Siren className="h-4 w-4 text-danger" />
            Initiate emergency muster
          </DialogTitle>
          <DialogDescription>
            Snapshots everyone currently on-site into a roll-call. Account for each person at the assembly point.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Site</Label>
            <Select value={siteId} onValueChange={setSiteId}>
              <SelectTrigger><SelectValue placeholder="Select a site" /></SelectTrigger>
              <SelectContent>{sites.map((site) => <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="muster-reason">Reason (optional)</Label>
            <Textarea id="muster-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Fire alarm, gas leak, evacuation drill" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button variant="destructive" disabled={!canSubmit} onClick={() => void submit()}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Start roll-call
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
