export type CommandCenterProject = {
  id: string;
  name: string;
  status: string;
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

export type WorkflowActor = { id?: string; role?: string };
export type WorkPassAction = 'submit' | 'approve' | 'second-approve' | 'reject';
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
  Submitted: { label: 'Pending consultant approval', className: 'bg-amber-100 text-amber-800' },
  PendingSecondApproval: { label: 'Pending supervisor approval', className: 'bg-violet-100 text-violet-800' },
  Approved: { label: 'Access granted', className: 'bg-emerald-100 text-emerald-800' },
  Rejected: { label: 'Rejected', className: 'bg-red-100 text-red-800' },
  Cancelled: { label: 'Cancelled', className: 'bg-slate-100 text-slate-500' },
  Completed: { label: 'Completed', className: 'bg-blue-100 text-blue-800' },
};

export function getWorkPassStatusPresentation(status: string): WorkPassStatusPresentation {
  return WORK_PASS_STATUS_PRESENTATION[status] ?? { label: status, className: 'bg-slate-100 text-slate-700' };
}

export function getWorkPassActions(
  workPass: CommandCenterWorkPass,
  project: CommandCenterProject,
  actor: WorkflowActor,
): WorkPassAction[] {
  if (!actor.id) return [];
  if (workPass.status === 'Draft' && workPass.submittedByUserId === actor.id) return ['submit'];
  if (workPass.status === 'Submitted' && project.consultantReviewerUserIds.includes(actor.id)) return ['approve', 'reject'];
  if (workPass.status === 'PendingSecondApproval' && project.supervisorUserId === actor.id) return ['second-approve', 'reject'];
  return [];
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
      label: 'Consultant decision',
      description: 'Consultant reviews submitted worker access',
      state: submitted ? 'current' : rejected && !secondApproval && !granted ? 'attention' : workPasses.length ? 'completed' : 'upcoming',
      count: submitted,
    },
    {
      id: 'supervisor-access',
      label: 'Supervisor decision',
      description: 'Project supervisor gives the final decision when required',
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
