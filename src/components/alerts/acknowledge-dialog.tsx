'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import type { SiteAlert } from '@/lib/api';
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
import { Textarea } from '@/components/ui/textarea';

export function AcknowledgeAlertDialog({
  alert,
  busy,
  onAcknowledge,
}: {
  alert: SiteAlert;
  busy: boolean;
  onAcknowledge: (alertId: string, note: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!open) setNote('');
  }, [open]);

  const submit = async () => {
    const ok = await onAcknowledge(alert.id, note.trim());
    if (ok) setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Acknowledge
      </Button>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            Acknowledge alert
          </DialogTitle>
          <DialogDescription>
            {alert.eventType} — {alert.siteName}
          </DialogDescription>
        </DialogHeader>
        <p className="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">{alert.description}</p>
        <div className="space-y-1.5">
          <Label htmlFor="ack-note">Acknowledgement note (optional)</Label>
          <Textarea
            id="ack-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="What action was taken in response?"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={() => void submit()}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Acknowledge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
