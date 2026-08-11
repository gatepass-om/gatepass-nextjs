export type CommandCenterProject = {
  id: string;
  name: string;
  status: string;
  supervisorUserId: string;
  consultantUserId: string;
  consultantApprovedAtUtc?: string | null;
};

export type CommandCenterWorkPass = {
  id: string;
  status: string;
  submittedByUserId: string;
};

export type WorkflowActor = { id?: string; role?: string };
export type WorkPassAction = 'submit' | 'approve' | 'second-approve' | 'reject';
export type ProjectAction = 'resubmit';
export type WorkflowStageState = 'completed' | 'current' | 'upcoming' | 'attention';

export type WorkflowStage = {
  id: 'project-approval' | 'contractor-preparation' | 'consultant-access' | 'supervisor-access' | 'access-granted';
  label: string;
  description: string;
  state: WorkflowStageState;
  count?: number;
};

export function getWorkPassActions(
  workPass: CommandCenterWorkPass,
  project: CommandCenterProject,
  actor: WorkflowActor,
): WorkPassAction[] {
  if (!actor.id) return [];
  if (workPass.status === 'Draft' && workPass.submittedByUserId === actor.id) return ['submit'];
  if (workPass.status === 'Submitted' && project.consultantUserId === actor.id) return ['approve', 'reject'];
  if (workPass.status === 'PendingSecondApproval' && project.supervisorUserId === actor.id) return ['second-approve', 'reject'];
  return [];
}

export function getProjectActions(project: CommandCenterProject, actor: WorkflowActor): ProjectAction[] {
  return project.status === 'Rejected' && project.supervisorUserId === actor.id ? ['resubmit'] : [];
}

export function getProjectWorkflowStages(
  project: CommandCenterProject,
  workPasses: CommandCenterWorkPass[],
): WorkflowStage[] {
  const projectApproved = project.status === 'Active' && Boolean(project.consultantApprovedAtUtc);
  const submitted = workPasses.filter((pass) => pass.status === 'Submitted').length;
  const secondApproval = workPasses.filter((pass) => pass.status === 'PendingSecondApproval').length;
  const granted = workPasses.filter((pass) => pass.status === 'Approved').length;
  const rejected = workPasses.filter((pass) => pass.status === 'Rejected').length;

  return [
    {
      id: 'project-approval',
      label: 'Project approval',
      description: project.status === 'Rejected' ? 'Consultant returned the project for correction' : 'Consultant confirms project scope',
      state: project.status === 'Rejected' ? 'attention' : projectApproved ? 'completed' : 'current',
    },
    {
      id: 'contractor-preparation',
      label: 'Contractor preparation',
      description: 'Contractors select workers, site and validity',
      state: !projectApproved ? 'upcoming' : workPasses.length ? 'completed' : 'current',
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
