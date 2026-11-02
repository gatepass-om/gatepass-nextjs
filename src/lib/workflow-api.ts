import { apiRequest } from './api';

export type BpmnValidationResult = {
  isValid: boolean;
  processKey?: string | null;
  errors: string[];
};

export type WorkflowDeploymentResult = {
  deploymentId: string;
  name?: string | null;
};

export type WorkflowTask = {
  id: string;
  name?: string | null;
  taskDefinitionKey?: string | null;
  processInstanceId?: string | null;
  assignee?: string | null;
  created?: string | null;
  due?: string | null;
};

export function validateBpmnRequest(token: string, bpmnXml: string) {
  return apiRequest<BpmnValidationResult>('/workflow-admin/validate', {
    method: 'POST',
    token,
    body: { bpmnXml },
  });
}

export function deployBpmnRequest(
  token: string,
  input: { name: string; tenantId: string; fileName: string; bpmnXml: string }
) {
  return apiRequest<WorkflowDeploymentResult>('/workflow-admin/deploy', {
    method: 'POST',
    token,
    body: input,
  });
}

export function listWorkflowTasksRequest(token: string, tenantId: string) {
  return apiRequest<WorkflowTask[]>(`/workflow-admin/tasks?tenantId=${encodeURIComponent(tenantId)}`, { token });
}

export function completeWorkflowTaskRequest(
  token: string,
  taskId: string,
  variables: Record<string, unknown>
) {
  return apiRequest<void>(`/workflow-admin/tasks/${encodeURIComponent(taskId)}/complete`, {
    method: 'POST',
    token,
    body: { variables },
  });
}
