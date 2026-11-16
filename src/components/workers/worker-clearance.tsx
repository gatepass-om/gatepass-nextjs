'use client';

import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { transitionWorkerClearance, type WorkerClearanceAction } from '@/lib/api';
import type { User } from '@/lib/types';
import { useSession } from '@/providers/session-provider';

import { getWorkerClearanceActions } from './worker-clearance-actions';

const actionLabels: Record<WorkerClearanceAction, string> = {
  submit: 'Submit for review',
  'start-review': 'Start review',
  clear: 'Clear worker',
  return: 'Return submission',
};

interface WorkerClearanceProps {
  workerId: string;
  initialStatus?: User['clearanceStatus'];
  /** The server's verdict on whether a stored Cleared still holds; 'Lapsed' means a blocking document is not in order. */
  effectiveStatus?: User['effectiveClearanceStatus'];
  lapsedReasons?: string[];
}

export function WorkerClearance({ workerId, initialStatus, effectiveStatus, lapsedReasons = [] }: WorkerClearanceProps) {
  const { token, user } = useSession();
  const { toast } = useToast();
  const [status, setStatus] = useState(initialStatus ?? 'Pending');
  // A clearance action changes the stored status, so a verdict computed before it no longer describes it.
  const [acted, setActed] = useState(false);
  const lapsed = !acted && status === 'Cleared' && effectiveStatus === 'Lapsed';
  const [note, setNote] = useState('');
  const [busyAction, setBusyAction] = useState<WorkerClearanceAction | null>(null);
  const actions = useMemo(
    () => user ? getWorkerClearanceActions(user.role, status) : [],
    [status, user],
  );

  const handleAction = async (action: WorkerClearanceAction) => {
    if (!token) {
      toast({ variant: 'destructive', title: 'Session expired', description: 'Please sign in again.' });
      return;
    }
    if (action === 'return' && !note.trim()) {
      toast({ variant: 'destructive', title: 'Reason required', description: 'Add a note before returning the submission.' });
      return;
    }

    setBusyAction(action);
    try {
      const result = await transitionWorkerClearance(token, workerId, action, note.trim() || undefined);
      setStatus(result.status);
      setActed(true);
      setNote('');
      toast({ title: 'Clearance updated', description: `Worker status is now ${result.status}.` });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Clearance update failed',
        description: error instanceof Error ? error.message : 'The clearance action could not be completed.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3">
          Worker clearance
          {lapsed
            ? <Badge variant="warning">Lapsed</Badge>
            : <Badge variant={status === 'Cleared' ? 'default' : 'secondary'}>{status}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {lapsed ? (
          <div role="status" className="rounded-md border border-warning/40 bg-warning-soft p-3 text-sm text-warning-ink">
            <p className="font-medium">Cleared by a reviewer, but the documents behind it are no longer in order.</p>
            <ul className="mt-1 list-disc ps-5">
              {lapsedReasons.map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
            <p className="mt-1">It returns to Cleared by itself once these are put right. The gate already enforces them.</p>
          </div>
        ) : null}
        {actions.some(action => action === 'clear' || action === 'return') && (
          <Textarea
            value={note}
            onChange={event => setNote(event.target.value)}
            placeholder="Review note or return reason"
          />
        )}
        {actions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {actions.map(action => (
              <Button
                key={action}
                type="button"
                variant={action === 'return' ? 'outline' : 'default'}
                disabled={busyAction !== null}
                onClick={() => void handleAction(action)}
              >
                {busyAction === action ? 'Updating…' : actionLabels[action]}
              </Button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No clearance actions are available for your role at this stage.</p>
        )}
      </CardContent>
    </Card>
  );
}
