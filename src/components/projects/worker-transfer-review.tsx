'use client';

import { useState } from 'react';
import { useSession } from '@/providers/session-provider';
import { apiRequest } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export type TransferWorker = {
  userId: string;
  name: string;
  contractorId?: string | null;
  transferStatus?: string | null;
  transferSources?: Array<{ projectName: string; siteName?: string | null }>;
  transferDecisionReason?: string | null;
  transferDecisionAtUtc?: string | null;
  assignmentEndedAtUtc?: string | null;
};

export function WorkerTransferReview({ passId, status, projectName, siteName, workers, onDecision }: {
  passId: string; status: string; projectName: string; siteName: string; workers: TransferWorker[]; onDecision: () => void;
}) {
  const { token, user } = useSession();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const transfers = workers.filter(worker => worker.transferStatus);
  if (transfers.length === 0) return null;

  async function decide(worker: TransferWorker, approve: boolean) {
    if (!token) return;
    const reason = reasons[worker.userId]?.trim();
    if (!approve && !reason) { setError('Enter a reason before rejecting the transfer.'); return; }
    setError(''); setBusyId(worker.userId);
    try {
      await apiRequest(`/work-passes/${passId}/workers/${worker.userId}/transfer-decision`, { method: 'POST', token, body: { approve, reason } });
      onDecision();
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'The decision could not be saved. Refresh this request and try again.'); }
    finally { setBusyId(null); }
  }

  return <section aria-labelledby="worker-transfers-heading" className="rounded-xl border bg-background p-5">
    <h2 id="worker-transfers-heading" className="text-lg font-semibold">Worker transfers</h2>
    <p className="mt-1 text-sm text-muted-foreground">Destination: {projectName} · {siteName}. The employing contractor decides the transfer; site access moves after the destination operator approves.</p>
    {error ? <p role="alert" className="mt-3 text-sm text-destructive">{error}</p> : null}
    <ul className="mt-4 divide-y">{transfers.map(worker => {
      const canDecide = status === 'PendingContractorApproval' && worker.transferStatus === 'Pending' && user?.role === 'Contractor Admin' && user.contractorId === worker.contractorId;
      return <li key={worker.userId} className="space-y-3 py-4 first:pt-0">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-medium">{worker.name}</h3><Badge variant="outline">{worker.transferStatus === 'Applied' ? 'Transferred' : `${worker.transferStatus} contractor decision`}</Badge></div>
        <div className="text-sm"><p className="font-medium">{worker.transferStatus === 'Applied' ? 'Previous assignment' : 'Current assignment'}</p><ul className="mt-1 space-y-1 text-muted-foreground">{worker.transferSources?.map((source, index) => <li key={index}>{source.projectName} · {source.siteName || 'Project roster; no site assigned'}</li>)}</ul></div>
        {worker.transferDecisionReason ? <p className="text-sm">Reason: {worker.transferDecisionReason}</p> : null}
        {worker.transferDecisionAtUtc ? <p className="text-xs text-muted-foreground">Decision recorded {new Date(worker.transferDecisionAtUtc).toLocaleString()}</p> : null}
        {canDecide ? <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Rejecting this transfer rejects the worker access request and leaves existing assignments in place.</p>
          <Label htmlFor={`transfer-reason-${worker.userId}`}>Decision note (required for rejection)</Label>
          <Textarea id={`transfer-reason-${worker.userId}`} value={reasons[worker.userId] ?? ''} onChange={event => setReasons(current => ({ ...current, [worker.userId]: event.target.value }))} />
          <div className="flex flex-wrap gap-2"><Button disabled={busyId !== null} onClick={() => void decide(worker, true)}>Approve transfer</Button><Button variant="outline" disabled={busyId !== null} onClick={() => void decide(worker, false)}>Reject transfer</Button></div>
        </div> : null}
      </li>;
    })}</ul>
  </section>;
}
