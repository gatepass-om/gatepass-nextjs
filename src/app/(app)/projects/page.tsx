'use client';

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  Edit3,
  FileCheck2,
  Plus,
  RefreshCw,
  Search,
  UsersRound,
} from 'lucide-react';
import { useAuthProtection } from '@/hooks/use-auth-protection';
import { Button } from '@/components/ui/button';
import { StatStrip } from '@/components/ui/stat-strip';
import { Skeleton } from '@/components/ui/skeleton';
import {
  apiRequest,
  listContractorsRequest,
  listOperatorsRequest,
  listSitesRequest,
  listUsersRequest,
  listProjectRolesRequest,
} from '@/lib/api';
import type { Contractor, ProjectRole } from '@/lib/types';
import { useSession } from '@/providers/session-provider';
import {
  ProjectWizardDialog,
  type ProjectRecord,
} from '@/components/projects/project-wizard-dialog';
import { calculateProjectPortfolio, getProjectStatusPresentation } from '@/components/projects/project-workflow';
import {
  type ProjectWorkPassRecord,
} from '@/components/access-requests/project-work-pass-queue';
import { getWorkPassActions, type WorkPassAction } from '@/components/projects/project-command-center';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

type NamedOption = { id: string; name: string };
type UserOption = NamedOption & { email?: string; role?: string; operatorId?: string; contractorId?: string };
type StatusFilter = 'All' | 'Active' | 'Upcoming' | 'Completed' | 'Needs attention';

const statusFilters: StatusFilter[] = ['All', 'Active', 'Upcoming', 'Completed', 'Needs attention'];

export default function ProjectsPage() {
  const { token, user } = useSession();
  const { isAuthorized, loading: authLoading, UnauthorizedComponent } = useAuthProtection(['Admin', 'Operator Admin', 'Manager', 'Supervisor', 'Contractor Admin']);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [operators, setOperators] = useState<NamedOption[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [sites, setSites] = useState<Array<NamedOption & { operatorId?: string; location?: string }>>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [projectRoles, setProjectRoles] = useState<ProjectRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectRecord | null>(null);
  const canConfigureProjects = Boolean(user && (
    ['Admin', 'Operator Admin', 'Manager'].includes(user.role)
    || (user.role === 'Supervisor' && user.operatorId)
  ));
  // Same gate access-requests/page.tsx used for canViewProjectWorkPasses — everyone
  // except Worker can have a pending decision (e.g. a Contractor Admin/Supervisor
  // acting as a project's consultant reviewer, who is NOT covered by canConfigureProjects).
  const canViewWorkPassQueue = Boolean(user && user.role !== 'Worker');
  const [projectWorkPasses, setProjectWorkPasses] = useState<ProjectWorkPassRecord[]>([]);
  const [busyWorkPassId, setBusyWorkPassId] = useState<string | null>(null);
  const [rejectWorkPass, setRejectWorkPass] = useState<ProjectWorkPassRecord | null>(null);
  const [workPassRejectReason, setWorkPassRejectReason] = useState('');

  const loadWorkspace = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const [projectData, operatorData, contractorData, userData, siteData, roleData, workPassData] = await Promise.all([
        apiRequest<ProjectRecord[]>('/projects', { token }),
        canConfigureProjects ? listOperatorsRequest(token) : Promise.resolve([]),
        canConfigureProjects ? listContractorsRequest(token) : Promise.resolve([]),
        canConfigureProjects ? listUsersRequest(token, { pageSize: 250 }) : Promise.resolve([]),
        canConfigureProjects ? listSitesRequest(token) : Promise.resolve([]),
        canConfigureProjects ? listProjectRolesRequest(token) : Promise.resolve([]),
        canViewWorkPassQueue ? apiRequest<ProjectWorkPassRecord[]>('/work-passes', { token }) : Promise.resolve([]),
      ]);
      setProjects(projectData);
      setOperators(operatorData as NamedOption[]);
      setContractors(contractorData as Contractor[]);
      setUsers(userData as UserOption[]);
      setSites(siteData);
      setProjectRoles(roleData);
      setProjectWorkPasses(workPassData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load the project workspace.');
    } finally {
      setLoading(false);
    }
  }, [canConfigureProjects, canViewWorkPassQueue, token]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const portfolio = useMemo(() => calculateProjectPortfolio(projects), [projects]);
  const filteredProjects = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    const now = Date.now();
    const attentionLimit = now + 30 * 86_400_000;
    return projects.filter((project) => {
      const matchesQuery = !query || [
        project.name,
        project.clientReference,
        project.operatorName,
        ...project.contractors.map((contractor) => contractor.contractorName),
      ].some((value) => value?.toLowerCase().includes(query));
      if (!matchesQuery) return false;

      const startsAt = new Date(project.validFromUtc).getTime();
      const endsAt = new Date(project.validToUtc).getTime();
      const normalized = project.status.toLowerCase();
      if (statusFilter === 'Active') return normalized === 'active' && startsAt <= now && endsAt >= now;
      if (statusFilter === 'Upcoming') return startsAt > now && !['completed', 'closed', 'expired'].includes(normalized);
      if (statusFilter === 'Completed') return ['completed', 'closed', 'expired'].includes(normalized);
      if (statusFilter === 'Needs attention') return ['pendingconsultantapproval', 'rejected'].includes(normalized) || (normalized === 'active' && endsAt <= attentionLimit);
      return true;
    });
  }, [deferredSearch, projects, statusFilter]);

  function startCreating() {
    setEditingProject(null);
    setWizardOpen(true);
  }

  function startEditing(project: ProjectRecord) {
    setEditingProject(project);
    setWizardOpen(true);
  }

  function handleSaved(saved: ProjectRecord) {
    setProjects((current) => {
      const existingIndex = current.findIndex((project) => project.id === saved.id);
      if (existingIndex === -1) return [saved, ...current];
      return current.map((project) => project.id === saved.id ? saved : project);
    });
  }

  async function handleWorkPassAction(
    workPass: ProjectWorkPassRecord,
    action: Exclude<WorkPassAction, 'reject'>,
  ) {
    if (!token) return;
    setBusyWorkPassId(workPass.id);
    setError('');
    setNotice('');
    try {
      const result = await apiRequest<ProjectWorkPassRecord | { workPass: ProjectWorkPassRecord; warnings: string[] }>(
        `/work-passes/${workPass.id}/${action}`,
        { method: 'POST', token },
      );
      if ('warnings' in result && result.warnings.length) {
        setNotice(`Approved with compliance follow-up: ${result.warnings.join(' ')}`);
      }
      await loadWorkspace();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'The work pass could not be updated.');
    } finally {
      setBusyWorkPassId(null);
    }
  }

  async function handleConfirmWorkPassReject() {
    if (!token || !rejectWorkPass || !workPassRejectReason.trim()) return;
    setBusyWorkPassId(rejectWorkPass.id);
    setError('');
    setNotice('');
    try {
      await apiRequest(`/work-passes/${rejectWorkPass.id}/reject`, {
        method: 'POST',
        token,
        body: { reason: workPassRejectReason.trim() },
      });
      setRejectWorkPass(null);
      setWorkPassRejectReason('');
      await loadWorkspace();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'The work pass could not be rejected.');
    } finally {
      setBusyWorkPassId(null);
    }
  }

  if (!authLoading && user && !isAuthorized) return <UnauthorizedComponent />;

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Projects</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadWorkspace()} disabled={loading} aria-label="Refresh projects">
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          {canConfigureProjects ? <Button onClick={startCreating}><Plus className="mr-2 h-4 w-4" /> New project</Button> : null}
        </div>
      </header>

      {error ? <div role="alert" className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger-ink">{error}</div> : null}

      {notice ? <div role="status" className="rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning-ink">{notice}</div> : null}

      <StatStrip items={[
        { label: 'active', value: portfolio.active },
        { label: 'awaiting decision', value: projectWorkPasses.filter((pass) => ['PendingContractorApproval', 'Submitted', 'PendingSecondApproval'].includes(pass.status)).length, tone: 'warning' },
        { label: 'work passes valid now', value: projectWorkPasses.filter((pass) => pass.status === 'Approved' && new Date(pass.validFromUtc) <= new Date() && new Date(pass.validToUtc) >= new Date()).length },
      ]} />

      <section className="overflow-hidden rounded-xl border border-border bg-card ">
        <div className="border-b border-border p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative min-w-0 flex-1 lg:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by project, client, operator or contractor"
                className="w-full rounded-lg border border-border py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
            </div>
            <div className="flex gap-1 overflow-x-auto" aria-label="Filter projects by status">
              {statusFilters.map((filter) => (
                <button key={filter} onClick={() => setStatusFilter(filter)}
                  className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${
                    statusFilter === filter ? 'bg-foreground text-white' : 'text-muted-foreground hover:bg-muted'
                  }`}>{filter}</button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 p-4">{[0, 1, 2].map((item) => <Skeleton key={item} className="h-24 w-full rounded-xl" />)}</div>
        ) : filteredProjects.length ? (
          <div className="divide-y divide-border">
            {filteredProjects.map((project) => {
              const actionable = projectWorkPasses
                .filter((pass) => pass.projectId === project.id)
                .map((pass) => ({ pass, actions: getWorkPassActions(pass, project, { id: user?.id, role: user?.role, operatorId: user?.operatorId ?? undefined, contractorId: user?.contractorId ?? undefined }) }))
                .filter((item) => item.actions.includes('approve') || item.actions.includes('second-approve'));
              return (
                <ProjectRow
                  key={project.id}
                  project={project}
                  onEdit={() => startEditing(project)}
                  canEdit={canConfigureProjects && (user?.role !== 'Supervisor' || project.supervisorUserId === user.id)}
                  actionablePasses={actionable}
                  busyWorkPassId={busyWorkPassId}
                  onApprove={(pass, action) => void handleWorkPassAction(pass, action)}
                  onReject={(pass) => { setRejectWorkPass(pass); setWorkPassRejectReason(''); }}
                />
              );
            })}
          </div>
        ) : (
          <div className="px-6 py-16 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground"><BriefcaseBusiness className="h-6 w-6" /></span>
            <h3 className="mt-4 font-semibold text-foreground">{projects.length ? 'No projects match this view' : 'Create your first project'}</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              {projects.length ? 'Try a different search or status filter.' : 'Projects connect operators, contractors, team members and work passes in one place.'}
            </p>
            {!projects.length && canConfigureProjects ? <Button className="mt-5" onClick={startCreating}><Plus className="mr-2 h-4 w-4" /> Create project</Button> : null}
          </div>
        )}
      </section>

      {token ? (
        <ProjectWizardDialog
          open={wizardOpen}
          token={token}
          project={editingProject}
          operators={operators}
          contractors={contractors}
          sites={sites}
          users={users}
          projectRoles={projectRoles}
          currentUserRole={user?.role}
          currentUserOperatorId={user?.operatorId ?? undefined}
          onOpenChange={setWizardOpen}
          onSaved={handleSaved}
        />
      ) : null}

      <Dialog open={Boolean(rejectWorkPass)} onOpenChange={(open) => { if (!open) { setRejectWorkPass(null); setWorkPassRejectReason(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject project work pass</DialogTitle>
            <DialogDescription className="sr-only">
              Record what the contractor must correct. The reason remains on the work-pass audit trail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="work-pass-reject-reason">Reason</Label>
            <Textarea
              id="work-pass-reject-reason"
              value={workPassRejectReason}
              onChange={(event) => setWorkPassRejectReason(event.target.value)}
              placeholder="e.g. Worker credentials are incomplete."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setRejectWorkPass(null); setWorkPassRejectReason(''); }} disabled={Boolean(busyWorkPassId)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void handleConfirmWorkPassReject()} disabled={!workPassRejectReason.trim() || Boolean(busyWorkPassId)}>
              {busyWorkPassId ? 'Rejecting…' : 'Reject work pass'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProjectRow({ project, onEdit, canEdit, actionablePasses, busyWorkPassId, onApprove, onReject }: {
  project: ProjectRecord;
  onEdit: () => void;
  canEdit: boolean;
  actionablePasses: Array<{ pass: ProjectWorkPassRecord; actions: WorkPassAction[] }>;
  busyWorkPassId: string | null;
  onApprove: (pass: ProjectWorkPassRecord, action: Exclude<WorkPassAction, 'reject'>) => void;
  onReject: (pass: ProjectWorkPassRecord) => void;
}) {
  const endsAt = new Date(project.validToUtc);
  const daysRemaining = Math.ceil((endsAt.getTime() - Date.now()) / 86_400_000);
  const needsAttention = project.status.toLowerCase() === 'active' && daysRemaining >= 0 && daysRemaining <= 30;
  const singleActionable = actionablePasses.length === 1 ? actionablePasses[0] : null;
  return (
    <article className="group grid gap-4 p-5 transition hover:bg-muted/70 lg:grid-cols-[minmax(0,1.2fr)_minmax(12rem,0.6fr)_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate font-semibold text-foreground">{project.name}</h3>
          <StatusBadge project={project} />
          {needsAttention ? <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning-ink">Ending soon</span> : null}
        </div>
        <p className="mt-1 truncate text-sm text-muted-foreground">
          {project.clientReference || 'No client reference'} · {project.operatorName}
        </p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>{formatDate(project.validFromUtc)} – {formatDate(project.validToUtc)}</span>
          <span>{project.contractors.length} contractor{project.contractors.length === 1 ? '' : 's'}</span>
          <span>{project.members.length} team member{project.members.length === 1 ? '' : 's'}</span>
        </div>
        {actionablePasses.length > 1 ? (
          <p className="mt-2 text-xs font-semibold text-warning-ink">{actionablePasses.length} work passes need your decision</p>
        ) : null}
      </div>
      <div>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-semibold tabular-nums text-foreground">{project.workPassCount}</span>
          <span className="text-sm text-muted-foreground">passes</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {singleActionable?.actions.includes('review-transfer') ? <Button asChild size="sm"><Link href={`/projects/${project.id}/access-requests/${singleActionable.pass.id}`}>Review transfer</Link></Button> : singleActionable ? (
          <>
            <Button
              size="sm"
              disabled={busyWorkPassId === singleActionable.pass.id}
              onClick={() => onApprove(singleActionable.pass, singleActionable.actions.includes('second-approve') ? 'second-approve' : 'approve')}
            >
              <CheckCircle2 className="mr-1.5 h-4 w-4" /> Approve
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busyWorkPassId === singleActionable.pass.id}
              onClick={() => onReject(singleActionable.pass)}
            >
              Reject
            </Button>
          </>
        ) : null}
        {canEdit ? <Button variant="outline" size="sm" onClick={onEdit}><Edit3 className="mr-1.5 h-4 w-4" /> Edit</Button> : null}
        <Button asChild size="sm" variant={singleActionable ? 'ghost' : 'default'}><Link href={`/projects/${project.id}`}>Manage <ArrowUpRight className="ml-1.5 h-4 w-4" /></Link></Button>
      </div>
    </article>
  );
}

function StatusBadge({ project }: { project: ProjectRecord }) {
  const presentation = getProjectStatusPresentation(project);
  const classes = {
    amber: 'bg-warning-soft text-warning-ink',
    emerald: 'bg-success-soft text-success-ink',
    blue: 'bg-pending-soft text-pending-ink',
    red: 'bg-danger-soft text-danger-ink',
    slate: 'bg-muted text-muted-foreground',
  }[presentation.tone];
  return (
    <span title={presentation.detail} className={`rounded-full px-2 py-0.5 text-xs font-semibold ${classes}`}>
      {presentation.label}
    </span>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}
