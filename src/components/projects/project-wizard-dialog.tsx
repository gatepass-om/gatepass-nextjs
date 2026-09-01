'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { apiRequest } from '@/lib/api';
import {
  buildCreateProjectPayload,
  filterSelectionOptions,
  resolveProjectOperatorId,
  shouldShowOperatorSelector,
  type ProjectDraft,
  type ProjectWizardStep,
  validateProjectStep,
} from './project-workflow';
import type { Contractor, ProjectRole, Site, UserRole } from '@/lib/types';

export type ProjectRecord = {
  id: string;
  name: string;
  clientReference?: string | null;
  description?: string | null;
  operatorId: string;
  operatorName: string;
  supervisorUserId: string;
  supervisorUserName?: string;
  isConsultantVerifierDelegationPending?: boolean;
  consultantCompanyId: string;
  consultantCompanyName: string;
  consultantReviewerUserIds: string[];
  consultantApprovedAtUtc?: string | null;
  consultantDecisionComments?: string | null;
  status: string;
  validFromUtc: string;
  validToUtc: string;
  contractors: Array<{ contractorId: string; contractorName: string }>;
  members: Array<{
    userId: string;
    name: string;
    email: string;
    role: string;
    contractorId?: string | null;
    projectRoleId?: string | null;
    projectRoleName?: string | null;
    fullProjectAccess: boolean;
  }>;
  workPassCount: number;
  siteIds: string[];
  sites: Site[];
};

type NamedOption = { id: string; name: string };
type UserOption = NamedOption & { email?: string; role?: string; operatorId?: string; contractorId?: string };

type ProjectWizardDialogProps = {
  open: boolean;
  token: string;
  project?: ProjectRecord | null;
  operators: NamedOption[];
  contractors: Contractor[];
  sites: Array<NamedOption & { operatorId?: string; location?: string }>;
  users: UserOption[];
  projectRoles: ProjectRole[];
  currentUserRole?: UserRole;
  currentUserOperatorId?: string;
  onOpenChange: (open: boolean) => void;
  onSaved: (project: ProjectRecord) => void;
};

function dateValue(value?: string | null) {
  return value ? value.slice(0, 10) : '';
}

function initialDraft(project?: ProjectRecord | null): ProjectDraft {
  const today = new Date();
  const defaultEnd = new Date(today.getTime() + 90 * 86_400_000);
  return {
    name: project?.name ?? '',
    clientReference: project?.clientReference ?? '',
    description: project?.description ?? '',
    operatorId: project?.operatorId ?? '',
    supervisorUserId: project?.supervisorUserId ?? '',
    consultantCompanyId: project?.consultantCompanyId ?? '',
    consultantReviewerUserIds: project?.consultantReviewerUserIds ?? [],
    validFromUtc: dateValue(project?.validFromUtc) || today.toISOString().slice(0, 10),
    validToUtc: dateValue(project?.validToUtc) || defaultEnd.toISOString().slice(0, 10),
    contractorIds: project?.contractors.map((item) => item.contractorId) ?? [],
    siteIds: project?.siteIds ?? [],
    memberIds: project?.members
      .filter((item) => !project.consultantReviewerUserIds.includes(item.userId))
      .map((item) => item.userId) ?? [],
    status: project?.status ?? 'Active',
  };
}

export function ProjectWizardDialog({
  open,
  token,
  project,
  operators,
  contractors,
  sites,
  users,
  projectRoles,
  currentUserRole,
  currentUserOperatorId,
  onOpenChange,
  onSaved,
}: ProjectWizardDialogProps) {
  const [draft, setDraft] = useState<ProjectDraft>(() => initialDraft(project));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [memberRoleIds, setMemberRoleIds] = useState<Record<string, string>>({});
  const [step, setStep] = useState<ProjectWizardStep>('details');
  const steps: ProjectWizardStep[] = ['details', 'sites', 'participants', 'review'];

  useEffect(() => {
    if (!open) return;
    const nextDraft = initialDraft(project);
    nextDraft.operatorId = resolveProjectOperatorId(
      currentUserOperatorId,
      nextDraft.operatorId,
    );
    setDraft(nextDraft);
    setErrors({});
    setSaveError('');
    setStep('details');
    setMemberRoleIds(Object.fromEntries((project?.members ?? []).map((member) => [member.userId, member.projectRoleId ?? ''])));
  }, [currentUserOperatorId, open, project]);

  const consultantCompanies = useMemo(
    () => contractors.filter((item) => item.companyType === 2 || item.companyType === 'Consultant'),
    [contractors],
  );
  const deliveryContractors = useMemo(
    () => contractors.filter((item) => item.companyType !== 2 && item.companyType !== 'Consultant'),
    [contractors],
  );
  const consultantSupervisorOptions = useMemo(
    () => users.filter((item) => item.contractorId === draft.consultantCompanyId && item.role === 'Supervisor'),
    [draft.consultantCompanyId, users],
  );
  const internalTeamOptions = useMemo(
    () => users.filter((item) => item.operatorId === draft.operatorId && !item.contractorId),
    [draft.operatorId, users],
  );
  const selectedMembers = useMemo(
    () => users.filter((item) => draft.memberIds.includes(item.id)),
    [draft.memberIds, users],
  );

  function updateField<K extends keyof ProjectDraft>(field: K, value: ProjectDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function toggleSelection(field: 'contractorIds' | 'memberIds' | 'siteIds' | 'consultantReviewerUserIds', id: string) {
    if (field === 'siteIds' && currentUserRole === 'Supervisor') {
      const selectedSite = sites.find((site) => site.id === id);
      setDraft((current) => {
        const isRemoving = current.siteIds.includes(id);
        const siteIds = isRemoving
          ? current.siteIds.filter((item) => item !== id)
          : [...current.siteIds, id];
        return {
          ...current,
          siteIds,
          operatorId: siteIds.length
            ? resolveProjectOperatorId(undefined, current.operatorId, selectedSite?.operatorId)
            : '',
        };
      });
      return;
    }

    setDraft((current) => ({
      ...current,
      [field]: current[field].includes(id)
        ? current[field].filter((item) => item !== id)
        : [...current[field], id],
    }));
  }

  async function saveProject() {
    const allErrors = {
      ...validateProjectStep('details', draft, { requireOperator: currentUserRole !== 'Supervisor' }),
      ...validateProjectStep('sites', draft),
      ...validateProjectStep('participants', draft),
    };
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      let savedProject: ProjectRecord;
      if (project) {
        savedProject = await apiRequest<ProjectRecord>(`/projects/${project.id}`, {
          method: 'PUT',
          token,
          body: {
            ...buildCreateProjectPayload(draft),
            contractorIds: draft.contractorIds,
          },
        });
      } else {
        const created = await apiRequest<ProjectRecord>('/projects', {
          method: 'POST',
          token,
          body: {
            ...buildCreateProjectPayload(draft),
            contractorIds: draft.contractorIds,
          },
        });
        savedProject = await apiRequest<ProjectRecord>(`/projects/${created.id}`, {
          method: 'PUT',
          token,
          body: { contractorIds: draft.contractorIds },
        });
      }

      const previousMemberIds = new Set(project?.members.map((member) => member.userId) ?? []);
      const nextMemberIds = new Set(draft.memberIds);
      const changedRoleIds = new Set((project?.members ?? [])
        .filter((member) => nextMemberIds.has(member.userId)
          && Boolean(memberRoleIds[member.userId])
          && memberRoleIds[member.userId] !== member.projectRoleId)
        .map((member) => member.userId));
      await Promise.all((project?.members ?? [])
        .filter((member) => !project?.consultantReviewerUserIds.includes(member.userId) && !nextMemberIds.has(member.userId))
        .map((member) => apiRequest(`/projects/${savedProject.id}/members/${member.userId}`, { method: 'DELETE', token })));
      await Promise.all(draft.memberIds
        .filter((userId) => !previousMemberIds.has(userId))
        .map((userId) => apiRequest(`/projects/${savedProject.id}/members`, {
          method: 'POST',
          token,
          body: { userId, projectRoleId: memberRoleIds[userId] || null },
        })));
      await Promise.all([...changedRoleIds].map((userId) => apiRequest(`/projects/${savedProject.id}/members/${userId}`, {
        method: 'PUT',
        token,
        body: { projectRoleId: memberRoleIds[userId] },
      })));
      const refreshed = await apiRequest<ProjectRecord>(`/projects/${savedProject.id}`, { token });
      onSaved(refreshed);
      onOpenChange(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'The project could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  function goNext() {
    const stepErrors = validateProjectStep(step, draft, { requireOperator: currentUserRole !== 'Supervisor' });
    if (Object.keys(stepErrors).length) {
      setErrors(stepErrors);
      return;
    }
    setErrors({});
    setStep(steps[Math.min(steps.indexOf(step) + 1, steps.length - 1)]);
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !saving && onOpenChange(nextOpen)}>
      <DialogContent className="flex max-h-[92vh] flex-col overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="shrink-0 border-b border-slate-200 px-6 py-5">
          <DialogTitle>{project ? `Edit ${project.name}` : 'Create a new project'}</DialogTitle>
          <DialogDescription>
            {project
              ? 'Update the project configuration and participating organisations.'
              : 'Set up the project, assign participants and review everything before creation.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid shrink-0 grid-cols-4 border-b border-slate-200 bg-slate-50 px-6 py-3 text-xs font-medium text-slate-500">
          {steps.map((item, index) => (
            <div key={item} className={item === step ? 'text-slate-950' : ''}>{index + 1}. {item === 'details' ? 'Details' : item === 'sites' ? 'Sites' : item === 'participants' ? 'Participants' : 'Review'}</div>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 space-y-8">
          {step === 'details' ? <div className="space-y-5">
            <StepHeading title="Project details" description="Define the commercial identity, owner and operating period." />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Project name" error={errors.name} className="sm:col-span-2">
                <input autoFocus value={draft.name} onChange={(event) => updateField('name', event.target.value)}
                  className={inputClass(errors.name)} placeholder="e.g. Harbour expansion phase 2" />
              </Field>
              <Field label="Client reference" hint="Optional contract, PO or tender number">
                <input value={draft.clientReference} onChange={(event) => updateField('clientReference', event.target.value)}
                  className={inputClass()} placeholder="e.g. PO-2044" />
              </Field>
              {shouldShowOperatorSelector(currentUserRole, currentUserOperatorId, Boolean(project)) ? (
                <Field label="Responsible operator" error={errors.operatorId}>
                  <select value={draft.operatorId} onChange={(event) => updateField('operatorId', event.target.value)}
                    className={inputClass(errors.operatorId)}>
                    <option value="">Select operator</option>
                    {operators.map((operator) => <option key={operator.id} value={operator.id}>{operator.name}</option>)}
                  </select>
                </Field>
              ) : null}
              <Field label="Start date" error={errors.validFromUtc}>
                <input type="date" value={draft.validFromUtc} onChange={(event) => updateField('validFromUtc', event.target.value)}
                  className={inputClass(errors.validFromUtc)} />
              </Field>
              <Field label="End date" error={errors.validToUtc}>
                <input type="date" value={draft.validToUtc} min={draft.validFromUtc}
                  onChange={(event) => updateField('validToUtc', event.target.value)}
                  className={inputClass(errors.validToUtc)} />
              </Field>
              <Field label="Description" hint="A short operational summary for project stakeholders" className="sm:col-span-2">
                <textarea value={draft.description} onChange={(event) => updateField('description', event.target.value)}
                  className={`${inputClass()} min-h-24 resize-y`} placeholder="What is this project responsible for?" />
              </Field>
            </div>
          </div> : null}

          {step === 'sites' ? <div className="space-y-6">
            <StepHeading title="Sites & operating scope" description="Select the operator sites where this project may request work passes and access." />
            <SelectionGroup
              title="Project sites"
              description="Permits will be restricted to these sites."
              emptyText="No sites are registered for this operator."
              options={sites
                .filter((site) => !draft.operatorId || site.operatorId === draft.operatorId)
                .map((site) => ({ ...site, subtitle: site.location, category: site.location }))}
              selectedIds={draft.siteIds}
              onToggle={(id) => toggleSelection('siteIds', id)}
              searchPlaceholder="Search sites by name or location"
              filterLabel="Location"
            />
            {errors.siteIds ? <p role="alert" className="text-sm font-medium text-red-600">{errors.siteIds}</p> : null}
          </div> : null}

          {step === 'participants' ? <div className="space-y-6">
            <StepHeading title="Participants" description="Choose the organisations and people responsible for delivery." />
            <Field label="Consultant company" error={errors.consultantCompanyId} hint="The consultant is an external company, not an operator user role.">
              <select value={draft.consultantCompanyId} onChange={(event) => {
                updateField('consultantCompanyId', event.target.value);
                updateField('supervisorUserId', '');
                updateField('consultantReviewerUserIds', []);
              }} className={inputClass(errors.consultantCompanyId)}>
                <option value="">Select consultant company</option>
                {consultantCompanies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
              </select>
            </Field>
            <Field label="Consultant verifier" hint="Optional. If you leave this unassigned, the consultant administrator is notified to choose one of their supervisors. The Operator Admin makes the final decision and can override the verification.">
              <select value={draft.supervisorUserId} onChange={(event) => updateField('supervisorUserId', event.target.value)} className={inputClass()} disabled={!draft.consultantCompanyId}>
                <option value="">Delegate to consultant administrator</option>
                {consultantSupervisorOptions.map((supervisor) => <option key={supervisor.id} value={supervisor.id}>{supervisor.name}{supervisor.email ? ` · ${supervisor.email}` : ''}</option>)}
              </select>
            </Field>
            <SelectionGroup
              title="Contractors"
              description="Companies permitted to supply workers or request work passes."
              emptyText="No contractors are registered."
              options={deliveryContractors}
              selectedIds={draft.contractorIds}
              onToggle={(id) => toggleSelection('contractorIds', id)}
              searchPlaceholder="Search contractors"
            />
            {errors.contractorIds ? <p role="alert" className="text-sm font-medium text-red-600">{errors.contractorIds}</p> : null}
            <SelectionGroup
              title="Project team"
              description="Internal users who can view or coordinate this project."
              emptyText="No eligible users are registered."
              options={internalTeamOptions.map((user) => ({
                ...user,
                subtitle: [user.role, user.email].filter(Boolean).join(' · '),
                category: user.role,
              }))}
              selectedIds={draft.memberIds}
              onToggle={(id) => toggleSelection('memberIds', id)}
              searchPlaceholder="Search people by name, role or email"
              filterLabel="Role"
            />
            {selectedMembers.length > 0 ? (
              <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                <div><h3 className="font-semibold text-slate-950">Project responsibilities</h3><p className="text-sm text-slate-500">Assign a workflow role to each selected team member.</p></div>
                {selectedMembers.map((member) => (
                  <label key={member.id} className="grid gap-2 sm:grid-cols-[1fr_15rem] sm:items-center">
                    <span><span className="block text-sm font-medium text-slate-900">{member.name}</span><span className="block text-xs text-slate-500">{member.role}</span></span>
                    <select className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm" value={memberRoleIds[member.id] || projectRoles.find((role) => role.isDefault)?.id || ''} onChange={(event) => setMemberRoleIds((current) => ({ ...current, [member.id]: event.target.value }))}>
                      {!projectRoles.some((role) => role.isDefault) ? <option value="">Use tenant default</option> : null}
                      {projectRoles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                    </select>
                  </label>
                ))}
                {!projectRoles.length ? <p className="text-sm text-amber-700">No project roles are configured yet. Team members will use the tenant default.</p> : null}
              </div>
            ) : null}
          </div> : null}

          {step === 'review' ? <div className="space-y-5">
            <StepHeading title="Review project" description="Confirm the scope and participants before saving." />
            <dl className="grid gap-4 rounded-xl border border-slate-200 p-5 sm:grid-cols-2">
              <ReviewItem label="Project" value={draft.name} />
              <ReviewItem label="Consultant verifier" value={consultantSupervisorOptions.find((item) => item.id === draft.supervisorUserId)?.name ?? 'Delegated to consultant administrator'} />
              <ReviewItem label="Operating period" value={`${draft.validFromUtc} – ${draft.validToUtc}`} />
              <ReviewItem label="Sites" value={`${draft.siteIds.length} selected`} />
              <ReviewItem label="Contractors" value={`${draft.contractorIds.length} selected`} />
              <ReviewItem label="Project team" value={`${draft.memberIds.length} selected`} />
            </dl>
          </div> : null}

          {saveError ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{saveError}</p> : null}
        </div>

        <DialogFooter className="shrink-0 border-t border-slate-200 bg-white px-6 py-4">
          <div className="flex w-full items-center justify-between">
            {step === 'details' ? <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
              : <Button type="button" variant="ghost" onClick={() => setStep(steps[steps.indexOf(step) - 1])} disabled={saving}>Back</Button>}
            {step === 'review' ? (
              <Button type="button" onClick={() => void saveProject()} disabled={saving}>{saving ? 'Saving…' : project ? 'Save changes' : 'Create project'}</Button>
            ) : (
              <Button type="button" onClick={goNext} disabled={saving}>Next</Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StepHeading({ title, description }: { title: string; description: string }) {
  return <div><h2 className="text-lg font-semibold text-slate-950">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p></div>;
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 font-medium text-slate-950">{value || '—'}</dd></div>;
}

function Field({ label, hint, error, className, children }: {
  label: string; hint?: string; error?: string; className?: string; children: React.ReactNode;
}) {
  return (
    <label className={`block text-sm font-medium text-slate-700 ${className ?? ''}`}>
      {label}
      {hint ? <span className="ml-2 font-normal text-slate-400">{hint}</span> : null}
      <span className="mt-1.5 block">{children}</span>
      {error ? <span className="mt-1 block text-xs font-medium text-red-600">{error}</span> : null}
    </label>
  );
}

function SelectionGroup({
  title,
  description,
  emptyText,
  options,
  selectedIds,
  onToggle,
  searchPlaceholder,
  filterLabel,
}: {
  title: string;
  description: string;
  emptyText: string;
  options: Array<NamedOption & { subtitle?: string; category?: string }>;
  selectedIds: string[];
  onToggle: (id: string) => void;
  searchPlaceholder: string;
  filterLabel?: string;
}) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const categories = useMemo(
    () => Array.from(new Set(options.map((option) => option.category).filter(Boolean) as string[])).sort(),
    [options],
  );
  const visibleOptions = useMemo(
    () => filterSelectionOptions(options, search, category),
    [category, options, search],
  );

  return (
    <section>
      <div className="flex items-end justify-between gap-4">
        <div><h3 className="font-semibold text-slate-900">{title}</h3><p className="text-sm text-slate-500">{description}</p></div>
        <span className="text-xs font-medium text-slate-500">{selectedIds.length} selected</span>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">{searchPlaceholder}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchPlaceholder}
            className={`${inputClass()} pl-9`}
          />
        </label>
        {filterLabel && categories.length > 1 ? (
          <label>
            <span className="sr-only">Filter by {filterLabel.toLocaleLowerCase()}</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className={`${inputClass()} sm:min-w-40`}
            >
              <option value="">All {filterLabel.toLocaleLowerCase()}s</option>
              {categories.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        ) : null}
      </div>
      <div className="mt-3 grid max-h-48 gap-2 overflow-y-auto rounded-xl border border-slate-200 p-2 sm:grid-cols-2">
        {visibleOptions.length ? visibleOptions.map((option) => {
          const selected = selectedIds.includes(option.id);
          return (
            <button type="button" key={option.id} onClick={() => onToggle(option.id)}
              className={`flex items-center gap-3 rounded-lg border p-3 text-left transition ${
                selected ? 'border-blue-300 bg-blue-50' : 'border-transparent hover:bg-slate-50'
              }`}>
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white'
              }`}>{selected ? <Check className="h-3.5 w-3.5" /> : null}</span>
              <span className="min-w-0"><span className="block truncate text-sm font-medium text-slate-800">{option.name}</span>
                {option.subtitle ? <span className="block truncate text-xs text-slate-500">{option.subtitle}</span> : null}</span>
            </button>
          );
        }) : <p className="p-5 text-sm text-slate-500">{options.length ? 'No matching results.' : emptyText}</p>}
      </div>
    </section>
  );
}

function inputClass(error?: string) {
  return `w-full rounded-lg border bg-white px-3 py-2.5 text-sm outline-none transition focus:ring-2 ${
    error ? 'border-red-300 focus:border-red-500 focus:ring-red-100' : 'border-slate-300 focus:border-blue-500 focus:ring-blue-100'
  }`;
}
