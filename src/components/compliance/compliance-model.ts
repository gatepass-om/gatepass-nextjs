import type { ExternalCompanyType, UserRole, WorkerEmployment } from '@/lib/types';

export function canManageWorkflowRoles(role: UserRole) {
  return role === 'Admin';
}

export const EXTERNAL_COMPANY_TYPES: ReadonlyArray<{ value: ExternalCompanyType; label: string }> = [
  { value: 1, label: 'Contractor' },
  { value: 2, label: 'Consultant' },
  { value: 3, label: 'Vendor' },
  { value: 4, label: 'Subcontractor' },
  { value: 5, label: 'Auditor' },
  { value: 6, label: 'Other' },
];

export const KNOWN_WORKFLOW_DUTIES = [
  { key: 'work-pass.review', label: 'Review work passes' },
  { key: 'work-pass.approve', label: 'Approve work passes' },
  { key: 'work-pass.final-approve', label: 'Give final work-pass approval' },
  { key: 'project.manage-crew', label: 'Manage project crew' },
  { key: 'project.full-access', label: 'Access the full project' },
] as const;

export function normalizeExternalCompanyType(value: unknown): ExternalCompanyType {
  const numeric = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof numeric === 'number' && EXTERNAL_COMPANY_TYPES.some((item) => item.value === numeric)) {
    return numeric as ExternalCompanyType;
  }
  if (typeof value === 'string') {
    const match = EXTERNAL_COMPANY_TYPES.find((item) => item.label.toLowerCase() === value.toLowerCase());
    if (match) return match.value;
  }
  return 1;
}

export function externalCompanyTypeLabel(value: unknown) {
  const normalized = normalizeExternalCompanyType(value);
  return EXTERNAL_COMPANY_TYPES.find((item) => item.value === normalized)?.label ?? 'Contractor';
}

export function normalizeDutyKeys(value: string | readonly string[]) {
  const parts = typeof value === 'string' ? value.split(/[\n,]/) : value;
  const normalized = [...new Set(parts.map((key) => key.trim().toLowerCase()).filter(Boolean))];
  if (normalized.some((key) => key.length > 100 || !/^[a-z0-9._-]+$/.test(key))) {
    throw new Error('Duty keys may contain only letters, numbers, dots, dashes, and underscores, up to 100 characters.');
  }
  return normalized;
}

export function buildEmploymentPayload(input: {
  jobPositionId?: string;
  contractorId?: string;
  operatorId?: string;
  existing?: WorkerEmployment | null;
  now?: Date;
}) {
  const existing = input.existing;
  return {
    contractorId: input.contractorId || existing?.contractorId || undefined,
    operatorId: input.operatorId || existing?.operatorId || undefined,
    employeeNumber: existing?.employeeNumber || undefined,
    trade: existing?.trade || undefined,
    jobPositionId: input.jobPositionId || undefined,
    department: existing?.department || undefined,
    supervisorUserId: existing?.supervisorUserId || undefined,
    employmentType: existing?.employmentType || 'Contract',
    validFromUtc: existing?.validFromUtc || (input.now ?? new Date()).toISOString(),
    validToUtc: existing?.validToUtc || undefined,
  };
}
