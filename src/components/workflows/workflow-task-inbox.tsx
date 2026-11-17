'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, ClipboardCheck, Loader2, RefreshCw, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { completeWorkflowTaskRequest, listWorkflowTasksRequest, type WorkflowTask } from '@/lib/workflow-api';

export function WorkflowTaskInbox({ token, tenantId }: { token: string; tenantId: string }) {
  const [tasks, setTasks] = useState<WorkflowTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadTasks = useCallback(async () => {
    if (!tenantId) {
      setTasks([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      setTasks(await listWorkflowTasksRequest(token, tenantId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load workflow tasks.');
    } finally {
      setLoading(false);
    }
  }, [tenantId, token]);

  useEffect(() => { void loadTasks(); }, [loadTasks]);

  async function complete(task: WorkflowTask, approved: boolean) {
    setCompletingId(task.id);
    setError('');
    try {
      await completeWorkflowTaskRequest(token, task.id, { approved });
      await loadTasks();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not complete the task.');
    } finally {
      setCompletingId(null);
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border bg-background shadow-sm">
      <div className="flex items-center justify-between gap-4 border-b p-5">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold"><ClipboardCheck className="size-5" />Human task inbox</h2>
          <p className="mt-1 text-sm text-muted-foreground">Approval steps waiting in the selected client workflow.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadTasks()} disabled={loading || !tenantId}>
          <RefreshCw className={loading ? 'animate-spin' : ''} />Refresh
        </Button>
      </div>
      {error && <div className="border-b bg-red-50 px-5 py-3 text-sm text-red-900" role="alert">{error}</div>}
      {!tenantId ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Select a client to see its tasks.</div>
      ) : loading && tasks.length === 0 ? (
        <div className="grid min-h-32 place-items-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
      ) : tasks.length === 0 ? (
        <div className="p-8 text-center"><ClipboardCheck className="mx-auto mb-3 size-8 text-muted-foreground" /><p className="font-medium">No tasks waiting</p><p className="mt-1 text-sm text-muted-foreground">New approval work will appear here.</p></div>
      ) : (
        <div className="divide-y">
          {tasks.map((task) => (
            <div key={task.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{task.name ?? 'Workflow task'}</span><Badge variant="outline">{task.taskDefinitionKey ?? 'task'}</Badge></div>
                <p className="mt-1 truncate text-sm text-muted-foreground">Instance {task.processInstanceId ?? 'unknown'}{task.created ? ` · Created ${new Date(task.created).toLocaleString()}` : ''}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => void complete(task, false)} disabled={completingId === task.id}><X />Reject</Button>
                <Button size="sm" onClick={() => void complete(task, true)} disabled={completingId === task.id}>{completingId === task.id ? <Loader2 className="animate-spin" /> : <Check />}Approve</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
