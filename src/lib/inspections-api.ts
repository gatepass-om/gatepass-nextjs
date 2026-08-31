import { apiRequest } from './api';

export type InspectorInspectionSummary = {
  inspectorUserId: string;
  inspectorName: string;
  totalInspections: number;
  uniqueWorkersInspected: number;
  complianceRate: number;
};

export type InspectionReasonSummary = {
  reason: string;
  count: number;
  percentage: number;
};

export type InspectionRecord = {
  id: string;
  workerId: string;
  workerName: string;
  workerCode?: string | null;
  inspectorUserId: string;
  inspectorName: string;
  siteId: string;
  siteName: string;
  outcome: 'Compliant' | 'NonCompliant';
  wrongfulConductReason?: string | null;
  notes?: string | null;
  inspectedAtUtc: string;
};

export type InspectionAnalytics = {
  totalInspections: number;
  uniqueWorkersInspected: number;
  compliantInspections: number;
  nonCompliantInspections: number;
  complianceRate: number;
  inspectors: InspectorInspectionSummary[];
  commonWrongfulConductReasons: InspectionReasonSummary[];
  recentInspections: InspectionRecord[];
};

export async function fetchInspectionAnalytics(
  token: string,
  filters: { fromUtc: string; toUtc: string; siteId?: string; inspectorUserId?: string },
) {
  const params = new URLSearchParams({ fromUtc: filters.fromUtc, toUtc: filters.toUtc });
  if (filters.siteId) params.set('siteId', filters.siteId);
  if (filters.inspectorUserId) params.set('inspectorUserId', filters.inspectorUserId);
  return apiRequest<InspectionAnalytics>(`/inspections/analytics?${params.toString()}`, { token });
}

export async function fetchWorkerInspectionHistory(token: string, workerId: string) {
  return apiRequest<InspectionRecord[]>(`/inspections/worker/${workerId}`, { token });
}
