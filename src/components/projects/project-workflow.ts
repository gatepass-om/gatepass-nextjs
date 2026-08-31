export type ProjectWizardStep = 'details' | 'sites' | 'participants' | 'review';

export type ProjectDraft = {
  name: string;
  clientReference: string;
  description: string;
  operatorId: string;
  supervisorUserId: string;
  consultantCompanyId: string;
  consultantReviewerUserIds: string[];
  validFromUtc: string;
  validToUtc: string;
  contractorIds: string[];
  siteIds: string[];
  memberIds: string[];
  status: string;
};

type PortfolioProject = Pick<
  ProjectDraft,
  'status' | 'validFromUtc' | 'validToUtc'
> & { workPassCount: number };

type ProjectStatusInput = Pick<ProjectDraft, 'status' | 'validFromUtc' | 'validToUtc'> & {
  consultantApprovedAtUtc?: string | null;
};

export type ProjectStatusPresentation = {
  label: string;
  tone: 'amber' | 'emerald' | 'blue' | 'red' | 'slate';
  detail: string;
};

export function getProjectStatusPresentation(
  project: ProjectStatusInput,
  now = new Date(),
): ProjectStatusPresentation {
  const normalized = project.status.toLowerCase();
  if (normalized === 'closed') {
    return {
      label: 'Closed',
      tone: 'slate',
      detail: 'This project is closed and no longer operational.',
    };
  }
  if (normalized === 'expired') {
    return {
      label: 'Expired',
      tone: 'slate',
      detail: 'The project period ended and new worker access requests are disabled.',
    };
  }
  if (normalized === 'active') {
    const nowTime = now.getTime();
    if (new Date(project.validFromUtc).getTime() > nowTime) {
      return {
        label: 'Upcoming',
        tone: 'blue',
        detail: 'The project has not started yet.',
      };
    }
    if (new Date(project.validToUtc).getTime() < nowTime) {
      return {
        label: 'Expired',
        tone: 'slate',
        detail: 'The project period has ended.',
      };
    }
    return {
      label: 'Active',
      tone: 'emerald',
      detail: 'The project is currently active.',
    };
  }

  return {
    label: project.status.replace(/([a-z])([A-Z])/g, '$1 $2'),
    tone: 'slate',
    detail: 'Current project workflow status.',
  };
}

export function validateProjectStep(
  step: ProjectWizardStep,
  draft: ProjectDraft,
  options: { requireOperator?: boolean } = {},
) {
  if (step === 'sites') {
    return draft.siteIds.length ? {} : { siteIds: 'Select at least one project site.' };
  }
  if (step === 'participants') {
    const errors: Record<string, string> = {};
    if (!draft.supervisorUserId) errors.supervisorUserId = 'Assign the project supervisor who will give final approval.';
    if (!draft.consultantCompanyId) errors.consultantCompanyId = 'Select a consultant company.';
    if (!draft.consultantReviewerUserIds.length) errors.consultantReviewerUserIds = 'Select at least one consultant reviewer.';
    if (!draft.contractorIds.length) errors.contractorIds = 'Select at least one delivery contractor.';
    return errors;
  }
  if (step !== 'details') return {};

  const errors: Record<string, string> = {};
  if (!draft.name.trim()) errors.name = 'Project name is required.';
  if (options.requireOperator !== false && !draft.operatorId) {
    errors.operatorId = 'Select the responsible operator.';
  }
  if (!draft.validFromUtc) errors.validFromUtc = 'Start date is required.';
  if (!draft.validToUtc) {
    errors.validToUtc = 'End date is required.';
  } else if (draft.validFromUtc && draft.validToUtc <= draft.validFromUtc) {
    errors.validToUtc = 'End date must be after the start date.';
  }
  return errors;
}

export function buildCreateProjectPayload(draft: ProjectDraft) {
  return {
    name: draft.name.trim(),
    clientReference: draft.clientReference.trim() || null,
    description: draft.description.trim() || null,
    operatorId: draft.operatorId,
    supervisorUserId: draft.supervisorUserId,
    consultantCompanyId: draft.consultantCompanyId,
    consultantReviewerUserIds: draft.consultantReviewerUserIds,
    siteIds: draft.siteIds,
    validFromUtc: new Date(`${draft.validFromUtc}T00:00:00Z`).toISOString(),
    validToUtc: new Date(`${draft.validToUtc}T23:59:59Z`).toISOString(),
  };
}

export function resolveProjectOperatorId(
  currentUserOperatorId: string | undefined,
  selectedOperatorId: string,
  selectedSiteOperatorId = '',
) {
  return currentUserOperatorId || selectedOperatorId || selectedSiteOperatorId;
}

export function shouldShowOperatorSelector(
  currentUserRole: string | undefined,
  currentUserOperatorId: string | undefined,
  isEditing: boolean,
) {
  return currentUserRole === 'Admin' && !currentUserOperatorId && !isEditing;
}

export type SelectionOption = {
  id: string;
  name: string;
  subtitle?: string;
  category?: string;
};

export function filterSelectionOptions(
  options: SelectionOption[],
  search: string,
  category: string,
) {
  const normalizedSearch = search.trim().toLocaleLowerCase();
  return options.filter((option) => {
    if (category && option.category !== category) return false;
    if (!normalizedSearch) return true;
    return `${option.name} ${option.subtitle ?? ''}`
      .toLocaleLowerCase()
      .includes(normalizedSearch);
  });
}

export function calculateProjectPortfolio(
  projects: PortfolioProject[],
  now = new Date(),
) {
  const today = now.getTime();
  const endingSoonLimit = today + 30 * 86_400_000;
  let active = 0;
  let upcoming = 0;
  let completed = 0;
  let endingSoon = 0;
  let workPasses = 0;

  for (const project of projects) {
    const normalizedStatus = project.status.toLowerCase();
    const startsAt = new Date(project.validFromUtc).getTime();
    const endsAt = new Date(project.validToUtc).getTime();
    if (normalizedStatus === 'active') active += 1;
    if (['completed', 'closed', 'expired'].includes(normalizedStatus)) completed += 1;
    if (startsAt > today && !['completed', 'closed', 'expired'].includes(normalizedStatus)) upcoming += 1;
    if (
      normalizedStatus === 'active'
      && endsAt >= today
      && endsAt <= endingSoonLimit
    ) endingSoon += 1;
    workPasses += project.workPassCount;
  }

  return {
    total: projects.length,
    active,
    upcoming,
    completed,
    endingSoon,
    workPasses,
  };
}
