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
}

export function WorkerClearance({ workerId, initialStatus }: WorkerClearanceProps) {
  const { token, user } = useSession();
  const { toast } = useToast();
  const [status, setStatus] = useState(initialStatus ?? 'Pending');
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
          <Badge variant={status === 'Cleared' ? 'default' : 'secondary'}>{status}</Badge>
        </CardTitle>
        <CardDescription>Submit, review, clear, or return this worker&apos;s onboarding record.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
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
