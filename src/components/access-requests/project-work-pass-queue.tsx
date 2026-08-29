import Link from 'next/link';
import { CheckCircle2, ClipboardCheck, ShieldCheck, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  getWorkPassQueueItems,
  type CommandCenterProject,
  type CommandCenterWorkPass,
  type WorkflowActor,
  type WorkPassAction,
} from '@/components/projects/project-command-center';

export type ProjectWorkPassRecord = CommandCenterWorkPass & {
  projectName: string;
  siteName: string;
  passNumber: string;
  validFromUtc: string;
  validToUtc: string;
  taskDescription?: string | null;
  workers: Array<{ userId: string; name: string; workerCode?: string | null }>;
  generatedAccessRequestIds: string[];
  rejectionReason?: string | null;
};

type ProjectWorkPassQueueProps = {
  workPasses: ProjectWorkPassRecord[];
  projects: CommandCenterProject[];
  actor: WorkflowActor;
  isLoading: boolean;
  busyWorkPassId?: string | null;
  onAction: (workPass: ProjectWorkPassRecord, action: Exclude<WorkPassAction, 'reject'>) => void;
  onReject: (workPass: ProjectWorkPassRecord) => void;
};

const STATUS_PRESENTATION: Record<string, { label: string; className: string }> = {
  Draft: { label: 'Draft', className: 'bg-slate-100 text-slate-700' },
  Submitted: { label: 'Pending consultant approval', className: 'bg-amber-100 text-amber-800' },
  PendingSecondApproval: { label: 'Pending supervisor approval', className: 'bg-violet-100 text-violet-800' },
  Approved: { label: 'Approved', className: 'bg-emerald-100 text-emerald-800' },
  Rejected: { label: 'Rejected', className: 'bg-red-100 text-red-800' },
  Cancelled: { label: 'Cancelled', className: 'bg-slate-100 text-slate-500' },
  Completed: { label: 'Completed', className: 'bg-blue-100 text-blue-800' },
};

export function ProjectWorkPassQueue({
  workPasses,
  projects,
  actor,
  isLoading,
  busyWorkPassId,
  onAction,
  onReject,
}: ProjectWorkPassQueueProps) {
  const queue = getWorkPassQueueItems(workPasses, projects, actor);
  const actionCount = queue.filter((item) => item.actions.some((action) => action !== 'submit')).length;

  return (
    <section className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
      <div className="flex flex-col gap-2 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold">Project work-pass pipeline</h2>
          <p className="text-sm text-muted-foreground">
            Contractor submissions appear here before the final access authorization is created.
          </p>
        </div>
        <span className="w-fit rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
          {actionCount} action{actionCount === 1 ? '' : 's'} required
        </span>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Loading project work passes…</div>
      ) : queue.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <ClipboardCheck className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <h3 className="mt-3 font-semibold">No project work passes in your scope</h3>
          <p className="mt-1 text-sm text-muted-foreground">Contractor submissions will appear here for tracking and approval.</p>
        </div>
      ) : (
        <div className="divide-y">
          {queue.map(({ workPass, project, actions }) => {
            const presentation = STATUS_PRESENTATION[workPass.status] ?? {
              label: workPass.status,
              className: 'bg-slate-100 text-slate-700',
            };
            const isBusy = busyWorkPassId === workPass.id;
            return (
              <article key={workPass.id} className="p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/projects/${workPass.projectId}`} className="font-semibold text-primary hover:underline">
                        {workPass.passNumber}
                      </Link>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${presentation.className}`}>
                        {presentation.label}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-foreground">{project?.name ?? workPass.projectName}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {workPass.siteName} · {workPass.workers.map((worker) => worker.name).join(', ') || 'No workers'}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {formatDate(workPass.validFromUtc)} – {formatDate(workPass.validToUtc)}
                      {workPass.taskDescription ? ` · ${workPass.taskDescription}` : ''}
                    </p>
                    {workPass.rejectionReason ? <p className="mt-2 text-sm font-medium text-red-700">Reason: {workPass.rejectionReason}</p> : null}
                    {workPass.generatedAccessRequestIds.length > 0 ? (
                      <p className="mt-2 text-xs font-medium text-emerald-700">
                        {workPass.generatedAccessRequestIds.length} access authorization{workPass.generatedAccessRequestIds.length === 1 ? '' : 's'} created
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {actions.includes('submit') ? <Button size="sm" disabled={isBusy} onClick={() => onAction(workPass, 'submit')}>Submit</Button> : null}
                    {actions.includes('approve') ? <Button size="sm" disabled={isBusy} onClick={() => onAction(workPass, 'approve')}><CheckCircle2 className="mr-1.5 h-4 w-4" /> Consultant approve</Button> : null}
                    {actions.includes('second-approve') ? <Button size="sm" disabled={isBusy} onClick={() => onAction(workPass, 'second-approve')}><ShieldCheck className="mr-1.5 h-4 w-4" /> Final approval</Button> : null}
                    {actions.includes('reject') ? <Button size="sm" variant="outline" disabled={isBusy} onClick={() => onReject(workPass)}><XCircle className="mr-1.5 h-4 w-4" /> Reject</Button> : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
}
