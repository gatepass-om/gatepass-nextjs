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
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  apiRequest,
  listContractorsRequest,
  listOperatorsRequest,
  listSitesRequest,
  listUsersRequest,
} from '@/lib/api';
import { useSession } from '@/providers/session-provider';
import {
  ProjectWizardDialog,
  type ProjectRecord,
} from '@/components/projects/project-wizard-dialog';
import { calculateProjectPortfolio, getProjectStatusPresentation } from '@/components/projects/project-workflow';

type NamedOption = { id: string; name: string };
type UserOption = NamedOption & { email?: string; role?: string; operatorId?: string; contractorId?: string };
type StatusFilter = 'All' | 'Active' | 'Upcoming' | 'Completed' | 'Needs attention';

const statusFilters: StatusFilter[] = ['All', 'Active', 'Upcoming', 'Completed', 'Needs attention'];

export default function ProjectsPage() {
  const { token, user } = useSession();
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [operators, setOperators] = useState<NamedOption[]>([]);
  const [contractors, setContractors] = useState<NamedOption[]>([]);
  const [sites, setSites] = useState<Array<NamedOption & { operatorId?: string; location?: string }>>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectRecord | null>(null);
  const canConfigureProjects = Boolean(user && (
    ['Admin', 'Operator Admin', 'Manager'].includes(user.role)
    || (user.role === 'Supervisor' && user.operatorId)
  ));

  const loadWorkspace = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const [projectData, operatorData, contractorData, userData, siteData] = await Promise.all([
        apiRequest<ProjectRecord[]>('/projects', { token }),
        canConfigureProjects ? listOperatorsRequest(token) : Promise.resolve([]),
        canConfigureProjects ? listContractorsRequest(token) : Promise.resolve([]),
        canConfigureProjects ? listUsersRequest(token, { pageSize: 250 }) : Promise.resolve([]),
        canConfigureProjects ? listSitesRequest(token) : Promise.resolve([]),
      ]);
      setProjects(projectData);
      setOperators(operatorData as NamedOption[]);
      setContractors(contractorData as NamedOption[]);
      setUsers(userData as UserOption[]);
      setSites(siteData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load the project workspace.');
    } finally {
      setLoading(false);
    }
  }, [canConfigureProjects, token]);

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

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-blue-600">
            <BriefcaseBusiness className="h-4 w-4" />
            Project portfolio
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Projects</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            Plan project periods, assign delivery partners and keep work-pass activity connected to the right operation.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadWorkspace()} disabled={loading} aria-label="Refresh projects">
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          {canConfigureProjects ? <Button onClick={startCreating}><Plus className="mr-2 h-4 w-4" /> New project</Button> : null}
        </div>
      </header>

      {error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <section aria-label="Project portfolio summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Active projects" value={portfolio.active} detail={`${portfolio.total} total projects`} icon={CircleDot} tone="blue" loading={loading} />
        <MetricCard label="Ending in 30 days" value={portfolio.endingSoon} detail="Active projects needing review" icon={CalendarClock} tone={portfolio.endingSoon ? 'amber' : 'slate'} loading={loading} />
        <MetricCard label="Work passes" value={portfolio.workPasses} detail="Across the project portfolio" icon={FileCheck2} tone="emerald" loading={loading} />
        <MetricCard label="Project coverage" value={portfolio.total ? `${Math.round((portfolio.active / portfolio.total) * 100)}%` : '—'}
          detail={`${portfolio.upcoming} upcoming · ${portfolio.completed} completed`} icon={CheckCircle2} tone="violet" loading={loading} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.55fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div><h2 className="font-semibold text-slate-950">Portfolio health</h2><p className="text-sm text-slate-500">How projects are distributed today</p></div>
            <span className="text-sm font-medium text-slate-500">{portfolio.total} projects</span>
          </div>
          <PortfolioBar active={portfolio.active} upcoming={portfolio.upcoming} completed={portfolio.completed} total={portfolio.total} />
        </div>
        <div className={`rounded-2xl border p-5 shadow-sm ${
          portfolio.endingSoon ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'
        }`}>
          <div className="flex items-start gap-3">
            <span className={`rounded-xl p-2.5 ${portfolio.endingSoon ? 'bg-amber-100 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
              <CalendarClock className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-semibold text-slate-950">{portfolio.endingSoon ? 'Dates need attention' : 'Project dates look healthy'}</h2>
              <p className="mt-1 text-sm leading-5 text-slate-600">
                {portfolio.endingSoon
                  ? `${portfolio.endingSoon} active project${portfolio.endingSoon === 1 ? '' : 's'} end within 30 days.`
                  : 'No active projects are approaching their end date.'}
              </p>
              {portfolio.endingSoon ? (
                <button onClick={() => setStatusFilter('Needs attention')} className="mt-3 text-sm font-semibold text-amber-800 hover:underline">
                  Review projects <ArrowUpRight className="inline h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative min-w-0 flex-1 lg:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by project, client, operator or contractor"
                className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
            </div>
            <div className="flex gap-1 overflow-x-auto" aria-label="Filter projects by status">
              {statusFilters.map((filter) => (
                <button key={filter} onClick={() => setStatusFilter(filter)}
                  className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${
                    statusFilter === filter ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}>{filter}</button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 p-4">{[0, 1, 2].map((item) => <Skeleton key={item} className="h-24 w-full rounded-xl" />)}</div>
        ) : filteredProjects.length ? (
          <div className="divide-y divide-slate-100">
            {filteredProjects.map((project) => (
              <ProjectRow
                key={project.id}
                project={project}
                token={token ?? ''}
                currentUserId={user?.id}
                onEdit={() => startEditing(project)}
                canEdit={canConfigureProjects && (user?.role !== 'Supervisor' || project.supervisorUserId === user.id)}
                onSaved={handleSaved}
              />
            ))}
          </div>
        ) : (
          <div className="px-6 py-16 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><BriefcaseBusiness className="h-6 w-6" /></span>
            <h3 className="mt-4 font-semibold text-slate-900">{projects.length ? 'No projects match this view' : 'Create your first project'}</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
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
          currentUserRole={user?.role}
          currentUserOperatorId={user?.operatorId ?? undefined}
          onOpenChange={setWizardOpen}
          onSaved={handleSaved}
        />
      ) : null}
    </div>
  );
}

function ProjectRow({ project, token, currentUserId, onEdit, onSaved, canEdit }: {
  project: ProjectRecord;
  token: string;
  currentUserId?: string;
  onEdit: () => void;
  onSaved: (project: ProjectRecord) => void;
  canEdit: boolean;
}) {
  const endsAt = new Date(project.validToUtc);
  const daysRemaining = Math.ceil((endsAt.getTime() - Date.now()) / 86_400_000);
  const needsAttention = project.status.toLowerCase() === 'active' && daysRemaining >= 0 && daysRemaining <= 30;
  return (
    <article className="group grid gap-4 p-5 transition hover:bg-slate-50/70 lg:grid-cols-[minmax(0,1.2fr)_minmax(12rem,0.6fr)_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate font-semibold text-slate-950">{project.name}</h3>
          <StatusBadge project={project} />
          {needsAttention ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Ending soon</span> : null}
        </div>
        <p className="mt-1 truncate text-sm text-slate-500">
          {project.clientReference || 'No client reference'} · {project.operatorName}
        </p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          <span>{formatDate(project.validFromUtc)} – {formatDate(project.validToUtc)}</span>
          <span>{project.contractors.length} contractor{project.contractors.length === 1 ? '' : 's'}</span>
          <span>{project.members.length} team member{project.members.length === 1 ? '' : 's'}</span>
        </div>
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Work-pass activity</p>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-2xl font-semibold tabular-nums text-slate-950">{project.workPassCount}</span>
          <span className="text-sm text-slate-500">passes</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {project.status === 'PendingConsultantApproval' && project.consultantUserId === currentUserId ? (
          <>
            <Button variant="outline" size="sm" onClick={async () => {
              const comments = window.prompt('Reason for rejecting this project:');
              if (comments === null) return;
              const rejected = await apiRequest<ProjectRecord>(`/projects/${project.id}/consultant-decision`, {
                method: 'POST',
                token,
                body: { approved: false, comments },
              });
              onSaved(rejected);
            }}>Reject</Button>
            <Button size="sm" onClick={async () => {
              const approved = await apiRequest<ProjectRecord>(`/projects/${project.id}/consultant-decision`, {
                method: 'POST',
                token,
                body: { approved: true },
              });
              onSaved(approved);
            }}>
              <CheckCircle2 className="mr-1.5 h-4 w-4" /> Approve
            </Button>
          </>
        ) : null}
        {canEdit ? <Button variant="outline" size="sm" onClick={onEdit}><Edit3 className="mr-1.5 h-4 w-4" /> Edit</Button> : null}
        <Button asChild size="sm"><Link href={`/projects/${project.id}`}>Manage <ArrowUpRight className="ml-1.5 h-4 w-4" /></Link></Button>
      </div>
    </article>
  );
}

function MetricCard({ label, value, detail, icon: Icon, tone, loading }: {
  label: string; value: number | string; detail: string; icon: typeof CircleDot; tone: string; loading: boolean;
}) {
  const toneClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700', amber: 'bg-amber-50 text-amber-700',
    emerald: 'bg-emerald-50 text-emerald-700', violet: 'bg-violet-50 text-violet-700',
    slate: 'bg-slate-100 text-slate-600',
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div><p className="text-sm font-medium text-slate-500">{label}</p>
          {loading ? <Skeleton className="mt-3 h-8 w-16" /> : <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>}</div>
        <span className={`rounded-xl p-2.5 ${toneClasses[tone]}`}><Icon className="h-5 w-5" /></span>
      </div>
      <p className="mt-3 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function PortfolioBar({ active, upcoming, completed, total }: { active: number; upcoming: number; completed: number; total: number }) {
  const denominator = Math.max(total, 1);
  const segments = [
    { label: 'Active', value: active, color: 'bg-blue-600' },
    { label: 'Upcoming', value: upcoming, color: 'bg-violet-500' },
    { label: 'Completed', value: completed, color: 'bg-emerald-500' },
  ];
  return (
    <div className="mt-6">
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
        {segments.map((segment) => <div key={segment.label} className={segment.color} style={{ width: `${(segment.value / denominator) * 100}%` }} />)}
      </div>
      <div className="mt-4 flex flex-wrap gap-5">
        {segments.map((segment) => <div key={segment.label} className="flex items-center gap-2 text-sm">
          <span className={`h-2.5 w-2.5 rounded-full ${segment.color}`} /><span className="text-slate-500">{segment.label}</span>
          <span className="font-semibold text-slate-900">{segment.value}</span></div>)}
      </div>
    </div>
  );
}

function StatusBadge({ project }: { project: ProjectRecord }) {
  const presentation = getProjectStatusPresentation(project);
  const classes = {
    amber: 'bg-amber-100 text-amber-800',
    emerald: 'bg-emerald-50 text-emerald-700',
    blue: 'bg-blue-50 text-blue-700',
    red: 'bg-red-50 text-red-700',
    slate: 'bg-slate-100 text-slate-600',
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
