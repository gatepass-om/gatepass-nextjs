export type CommandCenterProject = {
  id: string;
  name: string;
  status: string;
  operatorId?: string;
  supervisorUserId: string;
  consultantCompanyId: string;
  consultantReviewerUserIds: string[];
  consultantApprovedAtUtc?: string | null;
};

export type CommandCenterWorkPass = {
  id: string;
  projectId: string;
  status: string;
  submittedByUserId: string;
  submittingContractorId?: string | null;
};

/** focalCompanyIds: the companies a manager is NWS focal point for; they decide only those companies' requests. */
export type WorkflowActor = { id?: string; role?: string; operatorId?: string; contractorId?: string; focalCompanyIds?: string[] };
/** The companies whose active NWS focal point is this manager. */
export function focalCompanyIdsFor(companies: Array<{ id: string; focalPointUserId?: string | null; focalPointActive?: boolean }>, userId?: string) {
  if (!userId) return [];
  return companies.filter(company => company.focalPointUserId === userId && company.focalPointActive !== false).map(company => company.id);
}

export type WorkPassAction = 'submit' | 'approve' | 'second-approve' | 'reject' | 'review-transfer';
export type WorkflowStageState = 'completed' | 'current' | 'upcoming' | 'attention';

export type WorkflowStage = {
  id: 'contractor-preparation' | 'consultant-access' | 'supervisor-access' | 'access-granted';
  label: string;
  description: string;
  state: WorkflowStageState;
  count?: number;
};

export type WorkPassStatusPresentation = { label: string; className: string };

const WORK_PASS_STATUS_PRESENTATION: Record<string, WorkPassStatusPresentation> = {
  Draft: { label: 'Draft', className: 'bg-slate-100 text-slate-700' },
  PendingContractorApproval: { label: 'Pending contractor transfer approval', className: 'bg-amber-100 text-amber-800' },
  Submitted: { label: 'Pending consultant verification', className: 'bg-amber-100 text-amber-800' },
  PendingSecondApproval: { label: 'Pending operator approval', className: 'bg-violet-100 text-violet-800' },
  Approved: { label: 'Access granted', className: 'bg-emerald-100 text-emerald-800' },
  Rejected: { label: 'Rejected', className: 'bg-red-100 text-red-800' },
  Cancelled: { label: 'Cancelled', className: 'bg-slate-100 text-slate-500' },
  Completed: { label: 'Completed', className: 'bg-blue-100 text-blue-800' },
};

export function getWorkPassStatusPresentation(status: string): WorkPassStatusPresentation {
  return WORK_PASS_STATUS_PRESENTATION[status] ?? { label: status, className: 'bg-slate-100 text-slate-700' };
}

export function getWorkPassActions(
  workPass: CommandCenterWorkPass & { workers?: Array<{ userId: string; contractorId?: string | null; transferStatus?: string | null }> },
  project: CommandCenterProject,
  actor: WorkflowActor,
): WorkPassAction[] {
  if (!actor.id) return [];
  if (workPass.status === 'PendingContractorApproval' && ['Contractor Admin', 'Supervisor'].includes(actor.role ?? '') && Boolean(actor.contractorId)
    && workPass.workers?.some(worker => worker.transferStatus === 'Pending' && worker.contractorId === actor.contractorId)) return ['review-transfer'];
  if (workPass.status === 'Draft' && workPass.submittedByUserId === actor.id) return ['submit'];
  const isOperatorApprover = actor.operatorId === project.operatorId
    && (actor.role === 'Operator Admin'
      || (actor.role === 'Manager' && Boolean(workPass.submittingContractorId)
        && (actor.focalCompanyIds ?? []).includes(workPass.submittingContractorId!)));
  const isAssignedConsultantVerifier = project.supervisorUserId === actor.id
    && actor.role === 'Supervisor'
    && actor.contractorId === project.consultantCompanyId;
  if (workPass.status === 'Submitted' && (isAssignedConsultantVerifier || isOperatorApprover)) return ['approve', 'reject'];
  if (workPass.status === 'PendingSecondApproval' && isOperatorApprover) return ['second-approve', 'reject'];
  return [];
}

export function isWorkerComplianceSatisfied(jobRoleCompliant: boolean, clearanceStatus?: string | null) {
  return jobRoleCompliant && clearanceStatus === 'Cleared';
}

export type WorkerComplianceBadge = { label: string; className: string; compliant: boolean };

const AWAITING_VERIFICATION = new Set(['Pending', 'Submitted', 'UnderReview']);

/**
 * The per-worker badge on project screens. `jobRoleCompliant` is null when the position check could not be read
 * (a refused or failed request): that is shown as unknown, never as compliant. A worker whose credentials are in
 * order but who has not been verified yet is awaiting the consultant, not non-compliant.
 */
export function workerComplianceBadge(jobRoleCompliant: boolean | null | undefined, clearanceStatus?: string | null): WorkerComplianceBadge {
  if (jobRoleCompliant === false || clearanceStatus === 'Returned') {
    return { label: 'Non-compliant', className: 'bg-red-50 text-red-700', compliant: false };
  }
  if (jobRoleCompliant == null) {
    return { label: 'Not checked', className: 'bg-slate-100 text-slate-600', compliant: false };
  }
  if (clearanceStatus === 'Cleared') {
    return { label: 'Compliant', className: 'bg-emerald-50 text-emerald-700', compliant: true };
  }
  if (clearanceStatus && AWAITING_VERIFICATION.has(clearanceStatus)) {
    return { label: 'Awaiting verification', className: 'bg-amber-50 text-amber-700', compliant: false };
  }
  return { label: 'Non-compliant', className: 'bg-red-50 text-red-700', compliant: false };
}

export function getWorkPassQueueItems<T extends CommandCenterWorkPass>(
  workPasses: T[],
  projects: CommandCenterProject[],
  actor: WorkflowActor,
) {
  const projectsById = new Map(projects.map((project) => [project.id, project]));
  return workPasses.map((workPass) => {
    const project = projectsById.get(workPass.projectId);
    return {
      workPass,
      project,
      actions: project ? getWorkPassActions(workPass, project, actor) : [],
    };
  });
}

export function getProjectWorkflowStages(
  project: CommandCenterProject,
  workPasses: CommandCenterWorkPass[],
): WorkflowStage[] {
  const projectActive = project.status === 'Active';
  const submitted = workPasses.filter((pass) => pass.status === 'Submitted').length;
  const secondApproval = workPasses.filter((pass) => pass.status === 'PendingSecondApproval').length;
  const granted = workPasses.filter((pass) => pass.status === 'Approved').length;
  const rejected = workPasses.filter((pass) => pass.status === 'Rejected').length;

  return [
    {
      id: 'contractor-preparation',
      label: 'Contractor preparation',
      description: 'Contractors select workers, site and validity',
      state: !projectActive ? 'upcoming' : workPasses.length ? 'completed' : 'current',
      count: workPasses.length,
    },
    {
      id: 'consultant-access',
      label: 'Consultant verification',
      description: 'Assigned consultant supervisor verifies submitted worker access',
      state: submitted ? 'current' : rejected && !secondApproval && !granted ? 'attention' : workPasses.length ? 'completed' : 'upcoming',
      count: submitted,
    },
    {
      id: 'supervisor-access',
      label: 'Operator decision',
      description: 'The operator gives the final decision or override',
      state: secondApproval ? 'current' : granted ? 'completed' : 'upcoming',
      count: secondApproval,
    },
    {
      id: 'access-granted',
      label: 'Access granted',
      description: 'Workers receive access or compliance assignment confirmation',
      state: granted ? 'completed' : 'upcoming',
      count: granted,
    },
  ];
}
