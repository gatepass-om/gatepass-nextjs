'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { assessWorkerPositionRequest } from '@/lib/api';
import type { WorkerPositionCompliance } from '@/lib/types';
import { useSession } from '@/providers/session-provider';

export function WorkerPositionCompliancePanel({ workerId }: { workerId: string }) {
  const { token } = useSession();
  const [assessment, setAssessment] = useState<WorkerPositionCompliance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    let active = true;
    setLoading(true); setError('');
    assessWorkerPositionRequest(token, workerId)
      .then((result) => { if (active) setAssessment(result); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Could not assess this worker.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, workerId]);

  return <Card><CardHeader><CardTitle className="flex items-center gap-2">{assessment?.isCompliant ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <AlertTriangle className="h-5 w-5 text-amber-600" />}Position requirements</CardTitle><CardDescription>{assessment?.jobPositionName ? `Requirements for ${assessment.jobPositionName}.` : 'Credential requirements attached to the worker’s job position.'}</CardDescription></CardHeader><CardContent>{loading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : error ? <p className="text-sm text-destructive">{error}</p> : !assessment?.jobPositionId ? <p className="text-sm text-muted-foreground">No job position is assigned. Edit this person to assign one.</p> : assessment.credentials.length ? <div className="space-y-2">{assessment.credentials.map((credential) => <div key={credential.certificateTypeId} className="flex items-center justify-between gap-3 rounded-lg border p-3"><div><p className="text-sm font-medium">{credential.certificateTypeName}</p><p className="text-xs text-muted-foreground">{credential.minimumValidityDays ? `Must remain valid for ${credential.minimumValidityDays} days` : 'Must be valid today'}</p></div><Badge variant={credential.status === 'Valid' ? 'secondary' : 'destructive'}>{formatStatus(credential.status)}</Badge></div>)}</div> : <p className="text-sm text-muted-foreground">This position has no required credentials.</p>}</CardContent></Card>;
}

function formatStatus(status: string) {
  if (status === 'InsufficientValidity') return 'Expires too soon';
  return status.replace(/([a-z])([A-Z])/g, '$1 $2');
}
