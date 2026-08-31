'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, ArrowRight, ArrowUpRight, BriefcaseBusiness, CalendarClock, CheckCircle2,
  ClipboardCheck, FileText, FileWarning, MapPin, RefreshCw, ShieldCheck, UsersRound, XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { apiRequest, listUsersRequest } from '@/lib/api';
import type { Site, User } from '@/lib/types';
import { useSession } from '@/providers/session-provider';
import type { ProjectRecord } from '@/components/projects/project-wizard-dialog';
import { getProjectStatusPresentation } from '@/components/projects/project-workflow';
import { getWorkPassActions, getWorkPassStatusPresentation, type CommandCenterWorkPass } from '@/components/projects/project-command-center';
import { getEligibleProjectWorkers, getProjectSites } from '@/components/projects/project-worker-access';

type WorkPass = CommandCenterWorkPass & {
  projectId: string;
  projectName: string;
  siteId: string;
  siteName: string;
  passNumber: string;
  taskDescription?: string | null;
  validFromUtc: string;
  validToUtc: string;
  workers: Array<{ userId: string; name: string; workerCode?: string | null }>;
  generatedAccessRequestIds: string[];
  rejectionReason?: string | null;
  isActive: boolean;
};

type AuditEntry = { id: string; summary: string; actionType: string; occurredAtUtc: string; actorRole?: string | null };
type WorkPassApprovalResult = { workPass: WorkPass; warnings: string[] };

export default function ProjectCommandCenterPage() {
  const params = useParams<{ id: string }>();
  const { token, user } = useSession();
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [workPasses, setWorkPasses] = useState<WorkPass[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activity, setActivity] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [requestOpen, setRequestOpen] = useState(false);
  const [rejecting, setRejecting] = useState<WorkPass | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const load = useCallback(async () => {
    if (!token || !params.id) return;
    setLoading(true);
    setError('');
    try {
      const [projectData, passData, userData, auditData] = await Promise.all([
        apiRequest<ProjectRecord>(`/projects/${params.id}`, { token }),
        apiRequest<WorkPass[]>(`/work-passes?projectId=${params.id}`, { token }),
        listUsersRequest(token, { role: 'Worker', contractorId: user?.contractorId ?? undefined, pageSize: 250 }).catch(() => []),
        apiRequest<AuditEntry[]>(`/projects/${params.id}/activity`, { token }).catch(() => []),
      ]);
      setProject(projectData);
      setWorkPasses(passData);
      setSites(getProjectSites(projectData.sites ?? []));
      setUsers(userData as User[]);
      setActivity(auditData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load this project.');
    } finally {
      setLoading(false);
    }
  }, [params.id, token, user?.contractorId]);

  useEffect(() => { void load(); }, [load]);

  const pending = workPasses.filter((pass) => ['Submitted', 'PendingSecondApproval'].includes(pass.status)).length;
  const granted = workPasses.filter((pass) => pass.status === 'Approved').length;
  const canCreateRequest = Boolean(project && user && project.status === 'Active'
    && ['Contractor Admin', 'Supervisor'].includes(user.role)
    && (!user.contractorId || project.contractors.some((item) => item.contractorId === user.contractorId)));

  async function runAction(pass: WorkPass, action: 'submit' | 'approve' | 'second-approve') {
    if (!token) return;
    setError('');
    setNotice('');
    try {
      const result = await apiRequest<WorkPass | WorkPassApprovalResult>(`/work-passes/${pass.id}/${action}`, { method: 'POST', token });
      if ('warnings' in result && result.warnings.length) {
        setNotice(`Approved with compliance follow-up: ${result.warnings.join(' ')}`);
      }
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'The workflow action failed.');
    }
  }

  async function rejectPass() {
    if (!token || !rejecting || !rejectionReason.trim()) return;
    try {
      await apiRequest(`/work-passes/${rejecting.id}/reject`, { method: 'POST', token, body: { reason: rejectionReason.trim() } });
      setRejecting(null);
      setRejectionReason('');
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'The rejection failed.');
    }
  }

  if (loading) return <ProjectLoading />;
  if (!project) return <div className="p-6"><p className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error || 'Project not found.'}</p></div>;
  const status = getProjectStatusPresentation(project);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <Link href="/projects" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"><ArrowLeft className="h-4 w-4" /> Projects</Link>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">{project.name}</h1>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(status.tone)}`}>{status.label}</span>
          </div>
          <p className="mt-1 text-sm text-slate-500">{project.clientReference || 'No client reference'} · {project.operatorName}</p>
          <p className="mt-1 text-xs text-slate-400">{status.detail} {formatDate(project.validFromUtc)} – {formatDate(project.validToUtc)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
          {canCreateRequest ? <Button asChild variant="outline"><Link href={`/users?new=worker&returnTo=${encodeURIComponent(`/projects/${project.id}`)}`}>Register worker</Link></Button> : null}
          {canCreateRequest ? <Button onClick={() => setRequestOpen(true)}><ClipboardCheck className="mr-2 h-4 w-4" /> Request worker access</Button> : null}
        </div>
      </header>

      {error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {notice ? <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{notice}</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Assigned sites" value={project.siteIds.length} icon={MapPin} />
        <Link href={`/projects/${project.id}/personnel`}><Metric label="Project personnel" value={project.members.length} icon={UsersRound} /></Link>
        <Metric label="Pending decisions" value={pending} icon={FileWarning} accent={pending ? 'amber' : 'slate'} />
        <Metric label="Access granted" value={granted} icon={ShieldCheck} accent="emerald" />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.55fr)]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h2 className="font-semibold text-slate-950">Worker access requests</h2><p className="text-sm text-slate-500">Work passes follow the project’s two-stage decision flow</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{workPasses.length}</span></div>
          {workPasses.length ? <div className="h-[340px] divide-y divide-slate-100 overflow-y-auto">{workPasses.map((pass) => <WorkPassRow key={pass.id} pass={pass} project={project} actor={{ id: user?.id, role: user?.role, operatorId: user?.operatorId ?? undefined }} onAction={runAction} onReject={setRejecting} />)}</div>
            : <div className="px-6 py-14 text-center"><ClipboardCheck className="mx-auto h-8 w-8 text-slate-300" /><h3 className="mt-3 font-semibold text-slate-900">No worker requests yet</h3><p className="mt-1 text-sm text-slate-500">Assigned contractors can select project personnel and submit access.</p>{canCreateRequest ? <Button className="mt-4" onClick={() => setRequestOpen(true)}>Request worker access</Button> : null}</div>}
        </section>

        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold text-slate-950">Project responsibility</h2><div className="mt-4 space-y-4"><PersonRow label="Supervisor" name={project.supervisorUserName} /><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Consultant company</p><p className="mt-1 text-sm font-medium text-slate-900">{project.consultantCompanyName}</p><p className="text-xs text-slate-500">{project.members.filter((member) => project.consultantReviewerUserIds.includes(member.userId)).map((member) => member.name).join(', ') || 'No reviewers assigned'}</p></div></div></section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold text-slate-950">Project sites</h2><div className="mt-4 space-y-3">{sites.map((site) => <div key={site.id} className="rounded-xl border border-slate-200 p-3"><span className="font-medium text-slate-900">{site.name}</span></div>)}</div></section>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold text-slate-950">Activity history</h2>{activity.length ? <ol className="mt-4 divide-y divide-slate-100">{activity.map((item) => <li key={item.id} className="flex gap-3 py-3"><span className="mt-1 h-2 w-2 rounded-full bg-blue-500" /><div className="min-w-0"><p className="text-sm text-slate-800">{item.summary}</p><p className="mt-0.5 text-xs text-slate-400">{formatDateTime(item.occurredAtUtc)}{item.actorRole ? ` · ${item.actorRole}` : ' · System'}</p></div></li>)}</ol> : <p className="mt-3 text-sm text-slate-500">No project activity is available for your role yet.</p>}</section>

      <WorkerAccessDialog open={requestOpen} onOpenChange={setRequestOpen} token={token ?? ''} project={project} sites={sites} users={users} currentUser={user} onCreated={load} />
      <Dialog open={Boolean(rejecting)} onOpenChange={(open) => { if (!open) { setRejecting(null); setRejectionReason(''); } }}><DialogContent><DialogHeader><DialogTitle>Reject worker access</DialogTitle><DialogDescription>The contractor and affected workers will receive this reason in-system and by email when available.</DialogDescription></DialogHeader><div className="py-3"><Label htmlFor="rejection">Reason</Label><Textarea id="rejection" className="mt-2" value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} placeholder="Explain what must be corrected" /></div><DialogFooter><Button variant="outline" onClick={() => setRejecting(null)}>Cancel</Button><Button variant="destructive" disabled={!rejectionReason.trim()} onClick={() => void rejectPass()}>Reject request</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}

function WorkPassRow({ pass, project, actor, onAction, onReject }: { pass: WorkPass; project: ProjectRecord; actor: { id?: string; role?: string; operatorId?: string }; onAction: (pass: WorkPass, action: 'submit' | 'approve' | 'second-approve') => void; onReject: (pass: WorkPass) => void }) {
  const actions = getWorkPassActions(pass, project, actor);
  const statusPresentation = getWorkPassStatusPresentation(pass.status);
  return <article className="p-5 transition hover:bg-slate-50"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><Link href={`/projects/${project.id}/access-requests/${pass.id}`} className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-950">{pass.passNumber}</h3><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusPresentation.className}`}>{statusPresentation.label}</span></div><p className="mt-1 text-sm text-slate-500">{pass.siteName} · {pass.workers.map((worker) => worker.name).join(', ')}</p><p className="mt-2 text-xs text-slate-400">{formatDate(pass.validFromUtc)} – {formatDate(pass.validToUtc)}{pass.generatedAccessRequestIds.length ? ` · ${pass.generatedAccessRequestIds.length} access grant${pass.generatedAccessRequestIds.length === 1 ? '' : 's'}` : ''}</p>{pass.rejectionReason ? <p className="mt-2 text-sm font-medium text-red-700">Reason: {pass.rejectionReason}</p> : null}</Link><div className="flex flex-wrap gap-2">{actions.includes('submit') ? <Button size="sm" onClick={() => onAction(pass, 'submit')}>Submit request</Button> : null}{actions.includes('approve') ? <Button size="sm" onClick={() => onAction(pass, 'approve')}><CheckCircle2 className="mr-1.5 h-4 w-4" /> Approve</Button> : null}{actions.includes('second-approve') ? <Button size="sm" onClick={() => onAction(pass, 'second-approve')}><ShieldCheck className="mr-1.5 h-4 w-4" /> Final approval</Button> : null}{actions.includes('reject') ? <Button size="sm" variant="outline" onClick={() => onReject(pass)}><XCircle className="mr-1.5 h-4 w-4" /> Reject</Button> : null}</div></div></article>;
}

const PASS_STAGES: Array<{ status: string; label: string; description: string }> = [
  { status: 'Draft', label: 'Prepared', description: 'Contractor selects the crew and scope' },
  { status: 'Submitted', label: 'Consultant review', description: 'Reviewing consultant checks the request' },
  { status: 'PendingSecondApproval', label: 'Supervisor approval', description: 'Project supervisor gives the final decision' },
  { status: 'Approved', label: 'Access granted', description: 'Workers receive their access authorization' },
];

function LegacyWorkPassPanel({ pass, project, actor, onOpenChange, onAction, onReject }: {
  pass: WorkPass;
  project: ProjectRecord;
  actor: { id?: string; role?: string };
  onOpenChange: (open: boolean) => void;
  onAction: (pass: WorkPass, action: 'submit' | 'approve' | 'second-approve') => void;
  onReject: (pass: WorkPass) => void;
}) {
  const actions = getWorkPassActions(pass, project, actor);
  const statusPresentation = getWorkPassStatusPresentation(pass.status);
  const isTerminal = ['Rejected', 'Cancelled', 'Completed'].includes(pass.status);
  const stageIndex = PASS_STAGES.findIndex((stage) => stage.status === pass.status);

  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent className="w-[92vw] overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <div className="flex flex-wrap items-center gap-2">
            <SheetTitle>{pass.passNumber}</SheetTitle>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusPresentation.className}`}>{statusPresentation.label}</span>
          </div>
          <SheetDescription>{pass.siteName} · {project.name}</SheetDescription>
        </SheetHeader>

        <div className="space-y-5 py-6">
          {isTerminal ? (
            pass.rejectionReason ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                Returned to contractor: {pass.rejectionReason}
              </div>
            ) : null
          ) : (
            <div className="rounded-lg border border-border bg-background p-4">
              <div className="flex gap-1.5">
                {PASS_STAGES.map((stage, index) => (
                  <div
                    key={stage.status}
                    className={`h-1.5 flex-1 rounded-full ${index <= stageIndex ? 'bg-blue-600' : 'bg-slate-200'}`}
                  />
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {PASS_STAGES.map((stage, index) => (
                  <div key={stage.status}>
                    <p className={`text-xs font-semibold ${index === stageIndex ? 'text-blue-700' : index < stageIndex ? 'text-emerald-700' : 'text-slate-400'}`}>{stage.label}</p>
                    {index === stageIndex ? <p className="mt-0.5 text-xs text-slate-500">{stage.description}</p> : null}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400"><MapPin className="h-3.5 w-3.5" /> Site</div>
              <p className="mt-1.5 text-sm font-medium text-slate-900">{pass.siteName}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400"><CalendarClock className="h-3.5 w-3.5" /> Validity</div>
              <p className="mt-1.5 text-sm font-medium text-slate-900">{formatDate(pass.validFromUtc)} – {formatDate(pass.validToUtc)}</p>
            </div>
            {pass.taskDescription ? (
              <div className="rounded-lg border border-border p-3 sm:col-span-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400"><FileText className="h-3.5 w-3.5" /> Task</div>
                <p className="mt-1.5 text-sm text-slate-800">{pass.taskDescription}</p>
              </div>
            ) : null}
          </div>

          <div className="rounded-lg border border-border p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950"><UsersRound className="h-4 w-4" /> Workers ({pass.workers.length})</h3>
            </div>
            <div className="mt-3 divide-y divide-slate-100">
              {pass.workers.map((worker) => (
                <Link
                  key={worker.userId}
                  href={`/users/${worker.userId}`}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm hover:bg-slate-50"
                >
                  <span className="font-medium text-slate-900">{worker.name}</span>
                  <span className="flex items-center gap-2 text-xs text-slate-500">
                    {worker.workerCode ? <span className="font-mono">{worker.workerCode}</span> : null}
                    <span className="flex items-center gap-0.5 text-blue-600">View profile <ArrowUpRight className="h-3 w-3" /></span>
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {pass.generatedAccessRequestIds.length ? (
            <Link
              href="/access-requests"
              className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
            >
              {pass.generatedAccessRequestIds.length} access authorization{pass.generatedAccessRequestIds.length === 1 ? '' : 's'} created
              <span className="flex items-center gap-0.5">View in Site Access <ArrowUpRight className="h-3.5 w-3.5" /></span>
            </Link>
          ) : null}
        </div>

        <SheetFooter className="gap-2 sm:gap-0">
          {actions.includes('reject') ? <Button variant="outline" onClick={() => onReject(pass)}><XCircle className="mr-1.5 h-4 w-4" /> Reject</Button> : null}
          {actions.includes('submit') ? <Button onClick={() => onAction(pass, 'submit')}>Submit request</Button> : null}
          {actions.includes('approve') ? <Button onClick={() => onAction(pass, 'approve')}><CheckCircle2 className="mr-1.5 h-4 w-4" /> Approve</Button> : null}
          {actions.includes('second-approve') ? <Button onClick={() => onAction(pass, 'second-approve')}><ShieldCheck className="mr-1.5 h-4 w-4" /> Final approval</Button> : null}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function WorkerAccessDialog({ open, onOpenChange, token, project, sites, users, currentUser, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; token: string; project: ProjectRecord; sites: Site[]; users: User[]; currentUser?: User | null; onCreated: () => Promise<void> }) {
  const [step, setStep] = useState(0);
  const [siteId, setSiteId] = useState('');
  const [description, setDescription] = useState('');
  const [from, setFrom] = useState(project.validFromUtc.slice(0, 10));
  const [to, setTo] = useState(project.validToUtc.slice(0, 10));
  const [workers, setWorkers] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const availableWorkers = getEligibleProjectWorkers(users, currentUser?.contractorId, search, workers, showSelectedOnly);
  const selectedSite = sites.find((site) => site.id === siteId);
  async function createAndSubmit() { setSaving(true); setSubmitError(''); try { const pass = await apiRequest<WorkPass>('/work-passes', { method: 'POST', token, body: { projectId: project.id, siteId, taskDescription: description || undefined, workerIds: workers, validFromUtc: new Date(`${from}T00:00:00`).toISOString(), validToUtc: new Date(`${to}T23:59:59`).toISOString() } }); await apiRequest(`/work-passes/${pass.id}/submit`, { method: 'POST', token }); onOpenChange(false); setStep(0); setWorkers([]); setDescription(''); await onCreated(); } catch (requestError) { setSubmitError(requestError instanceof Error ? requestError.message : 'The worker access request could not be submitted.'); } finally { setSaving(false); } }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Request worker access</DialogTitle><DialogDescription>Step {step + 1} of 3 · {['Scope and dates', 'Select workers', 'Review and submit'][step]}</DialogDescription></DialogHeader><div className="flex gap-2 py-2">{[0, 1, 2].map((item) => <span key={item} className={`h-1.5 flex-1 rounded-full ${item <= step ? 'bg-blue-600' : 'bg-slate-200'}`} />)}</div>{step === 0 ? <div className="grid gap-4 py-3"><div><Label>Project site</Label><select className="mt-2 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" value={siteId} onChange={(event) => setSiteId(event.target.value)}><option value="">Select a site</option>{sites.map((site) => <option key={site.id} value={site.id}>{site.name} · {site.requiresAccessApproval === false ? 'compliance only' : 'authorization required'}</option>)}</select></div><div><Label>Work description</Label><Textarea className="mt-2" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What will this crew do?" /></div><div className="grid grid-cols-2 gap-3"><div><Label>Valid from</Label><Input className="mt-2" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></div><div><Label>Valid to</Label><Input className="mt-2" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></div></div></div> : null}{step === 1 ? <div className="py-3"><div className="flex flex-col gap-2 sm:flex-row"><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by worker name, email or national ID" /><Button type="button" variant={showSelectedOnly ? 'default' : 'outline'} onClick={() => setShowSelectedOnly((current) => !current)}>Selected ({workers.length})</Button></div><p className="mt-2 text-xs text-slate-500">{availableWorkers.length} eligible worker{availableWorkers.length === 1 ? '' : 's'} from your contractor.</p><div className="mt-3 max-h-72 space-y-2 overflow-y-auto">{availableWorkers.map((worker) => <label key={worker.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50"><input type="checkbox" checked={workers.includes(worker.id)} onChange={() => setWorkers((current) => current.includes(worker.id) ? current.filter((id) => id !== worker.id) : [...current, worker.id])} /><span><span className="block text-sm font-medium text-slate-900">{worker.name}</span><span className="block text-xs text-slate-500">{worker.idNumber ? `National ID: ${worker.idNumber}` : worker.email || 'No email — supervisor-assisted notification'}</span></span></label>)}{availableWorkers.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">No eligible workers match these filters.</p> : null}</div></div> : null}{step === 2 ? <div className="space-y-3 py-3"><div className="rounded-xl bg-slate-50 p-4 text-sm"><p><strong>Site:</strong> {selectedSite?.name}</p><p className="mt-1"><strong>Workers:</strong> {workers.length}</p><p className="mt-1"><strong>Period:</strong> {formatDate(from)} – {formatDate(to)}</p><p className="mt-1"><strong>Operating model:</strong> {selectedSite?.requiresAccessApproval === false ? 'Compliance assignment; no access authorization will be created' : 'Approved access authorization will be created'}</p></div><p className="text-sm text-slate-500">Submitting sends the request to the assigned consultant. If the tenant requires a second decision, it then moves to the project supervisor.</p></div> : null}{submitError ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{submitError}</p> : null}<DialogFooter><Button variant="outline" onClick={() => step ? setStep(step - 1) : onOpenChange(false)}>{step ? 'Back' : 'Cancel'}</Button>{step < 2 ? <Button onClick={() => setStep(step + 1)} disabled={(step === 0 && (!siteId || !from || !to)) || (step === 1 && workers.length === 0)}>Continue <ArrowRight className="ml-2 h-4 w-4" /></Button> : <Button onClick={() => void createAndSubmit()} disabled={saving}>{saving ? 'Submitting…' : 'Submit request'}</Button>}</DialogFooter></DialogContent></Dialog>;
}

function PersonRow({ label, name }: { label: string; name?: string }) { return <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-700">{name?.slice(0, 2).toUpperCase() || '—'}</span><div className="min-w-0"><p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p><p className="truncate text-sm font-semibold text-slate-900">{name || 'Not assigned'}</p></div></div>; }
function Metric({ label, value, icon: Icon, accent = 'blue' }: { label: string; value: number; icon: typeof BriefcaseBusiness; accent?: string }) { const colors: Record<string, string> = { blue: 'bg-blue-50 text-blue-700', amber: 'bg-amber-50 text-amber-700', emerald: 'bg-emerald-50 text-emerald-700', slate: 'bg-slate-100 text-slate-600' }; return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-2 text-3xl font-semibold text-slate-950">{value}</p></div><span className={`rounded-xl p-2.5 ${colors[accent]}`}><Icon className="h-5 w-5" /></span></div></div>; }
function ProjectLoading() { return <div className="space-y-6 p-6"><Skeleton className="h-20 w-2/3" /><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{[1,2,3,4].map((item) => <Skeleton key={item} className="h-28" />)}</div><Skeleton className="h-48" /><Skeleton className="h-80" /></div>; }
function statusClass(tone: string) { return { amber: 'bg-amber-100 text-amber-800', emerald: 'bg-emerald-50 text-emerald-700', blue: 'bg-blue-50 text-blue-700', red: 'bg-red-50 text-red-700', slate: 'bg-slate-100 text-slate-600' }[tone] || 'bg-slate-100 text-slate-600'; }
function formatDate(value: string) { return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }
