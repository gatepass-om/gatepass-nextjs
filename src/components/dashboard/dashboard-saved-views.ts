export type ReportingWindow = '24h' | '7d' | '30d' | 'custom';
export type DashboardRequestStatusFilter = 'all' | 'Pending' | 'Approved' | 'Denied';

export type DashboardSavedView = {
  id: string;
  name: string;
  operatorId: string;
  siteId: string;
  externalCompanyId: string;
  accessRequestStatus: DashboardRequestStatusFilter;
  reportingWindow: ReportingWindow;
  customFromLocal?: string;
  customToLocal?: string;
};

export function parseDashboardSavedViews(rawValue: string | null): DashboardSavedView[] {
  if (!rawValue) return [];

  try {
    const parsedValue: unknown = JSON.parse(rawValue);
    if (!Array.isArray(parsedValue)) return [];

    return parsedValue
      .map(normalizeSavedView)
      .filter((view): view is DashboardSavedView => view !== null)
      .slice(0, 10);
  } catch {
    return [];
  }
}

function normalizeSavedView(value: unknown): DashboardSavedView | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<DashboardSavedView>;
  const reportingWindow = candidate.reportingWindow;
  const accessRequestStatus = candidate.accessRequestStatus ?? 'all';

  if (typeof candidate.id !== 'string'
    || typeof candidate.name !== 'string'
    || typeof candidate.operatorId !== 'string'
    || typeof candidate.siteId !== 'string'
    || (reportingWindow !== '24h'
      && reportingWindow !== '7d'
      && reportingWindow !== '30d'
      && reportingWindow !== 'custom')
    || (accessRequestStatus !== 'all'
      && accessRequestStatus !== 'Pending'
      && accessRequestStatus !== 'Approved'
      && accessRequestStatus !== 'Denied')) {
    return null;
  }

  if (reportingWindow === 'custom'
    && (typeof candidate.customFromLocal !== 'string'
      || typeof candidate.customToLocal !== 'string')) {
    return null;
  }

  return {
    id: candidate.id,
    name: candidate.name,
    operatorId: candidate.operatorId,
    siteId: candidate.siteId,
    externalCompanyId: typeof candidate.externalCompanyId === 'string'
      ? candidate.externalCompanyId
      : 'all',
    accessRequestStatus,
    reportingWindow,
    customFromLocal: candidate.customFromLocal,
    customToLocal: candidate.customToLocal,
  };
}
