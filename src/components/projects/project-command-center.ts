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
};

export type WorkflowActor = { id?: string; role?: string; operatorId?: string; contractorId?: string };
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
  Draft: { label: 'Draft', className: 'bg-muted text-muted-foreground' },
  PendingContractorApproval: { label: 'Pending contractor transfer approval', className: 'bg-warning-soft text-warning-ink' },
  Submitted: { label: 'Pending consultant verification', className: 'bg-warning-soft text-warning-ink' },
  PendingSecondApproval: { label: 'Pending operator approval', className: 'bg-muted text-violet-800' },
  Approved: { label: 'Access granted', className: 'bg-success-soft text-success-ink' },
  Rejected: { label: 'Rejected', className: 'bg-danger-soft text-danger-ink' },
  Cancelled: { label: 'Cancelled', className: 'bg-muted text-muted-foreground' },
  Completed: { label: 'Completed', className: 'bg-pending-soft text-pending-ink' },
};

export function getWorkPassStatusPresentation(status: string): WorkPassStatusPresentation {
  return WORK_PASS_STATUS_PRESENTATION[status] ?? { label: status, className: 'bg-muted text-muted-foreground' };
}

export function getWorkPassActions(
  workPass: CommandCenterWorkPass & { workers?: Array<{ userId: string; contractorId?: string | null; transferStatus?: string | null }> },
  project: CommandCenterProject,
  actor: WorkflowActor,
): WorkPassAction[] {
  if (!actor.id) return [];
  if (workPass.status === 'PendingContractorApproval' && actor.role === 'Contractor Admin'
    && workPass.workers?.some(worker => worker.transferStatus === 'Pending' && worker.contractorId === actor.contractorId)) return ['review-transfer'];
  if (workPass.status === 'Draft' && workPass.submittedByUserId === actor.id) return ['submit'];
  const isOperatorApprover = ['Operator Admin', 'Manager'].includes(actor.role ?? '')
    && actor.operatorId === project.operatorId;
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
