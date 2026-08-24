export type DashboardMetricSummary = {
  totalOnSite: number;
  movements: { entries: number; exits: number; denied: number; total: number };
  pendingRequests: number;
  deniedRequests: number;
  expiry: { expired: number; next7Days: number; days8To30: number };
  workforce: {
    eligibleWorkers: number;
    clearedWorkers: number;
    pendingWorkers: number;
    returnedWorkers: number;
    readinessRate: number;
  };
  portfolio: {
    registeredWorkers: number;
    projects: number;
    sites: number;
    externalCompanies: number;
    consultants: number;
  };
  actionQueue: Array<{
    key: string;
    count: number;
    overdueCount: number;
    oldestAtUtc?: string | null;
    applicable: boolean;
  }>;
  audience: { metricKeys: string[] };
};

export type DashboardMetricCard = {
  key: string;
  label: string;
  value: number | string;
  detail: string;
  tone: 'teal' | 'blue' | 'amber' | 'green' | 'red';
};

const ASSIGNED_DECISION_KEYS = new Set([
  'work-pass-consultant-approvals',
  'work-pass-supervisor-approvals',
]);

const metricRegistry: Record<string, (summary: DashboardMetricSummary) => DashboardMetricCard> = {
  'people-on-site': (summary) => ({
    key: 'people-on-site',
    label: 'People on site',
    value: summary.totalOnSite,
    detail: 'Currently present in this scope',
    tone: 'teal',
  }),
  'pending-decisions': (summary) => ({
    key: 'pending-decisions',
    label: 'Pending decisions',
    value: summary.pendingRequests,
    detail: decisionQueueDetail(summary.actionQueue.find((item) => item.key === 'pending-approvals')),
    tone: 'amber',
  }),
  'assigned-decisions': (summary) => {
    const assigned = summary.actionQueue.filter((item) => item.applicable && ASSIGNED_DECISION_KEYS.has(item.key));
    const count = assigned.reduce((total, item) => total + item.count, 0);
    const overdue = assigned.reduce((total, item) => total + item.overdueCount, 0);
    return {
      key: 'assigned-decisions',
      label: 'Assigned decisions',
      value: count,
      detail: overdue > 0 ? `${overdue} overdue` : 'Your work-pass decision queue',
      tone: overdue > 0 ? 'red' : 'amber',
    };
  },
  'workforce-readiness': (summary) => ({
    key: 'workforce-readiness',
    label: 'Workforce readiness',
    value: summary.workforce.eligibleWorkers === 0 ? '—' : `${summary.workforce.readinessRate}%`,
    detail: summary.workforce.eligibleWorkers === 0
      ? 'No workforce in this scope'
      : `${summary.workforce.clearedWorkers} of ${summary.workforce.eligibleWorkers} workers cleared`,
    tone: 'green',
  }),
  'workers-needing-action': (summary) => ({
    key: 'workers-needing-action',
    label: 'Workers needing action',
    value: summary.workforce.pendingWorkers + summary.workforce.returnedWorkers,
    detail: `${summary.workforce.returnedWorkers} returned · ${summary.workforce.pendingWorkers} not submitted`,
    tone: 'amber',
  }),
  'credential-risk': (summary) => ({
    key: 'credential-risk',
    label: 'Credential risk signals',
    value: summary.expiry.expired + summary.expiry.next7Days + summary.expiry.days8To30,
    detail: `${summary.expiry.expired} expired · ${summary.expiry.next7Days + summary.expiry.days8To30} due in 30 days`,
    tone: summary.expiry.expired > 0 ? 'red' : 'amber',
  }),
  'compliance-exceptions': (summary) => ({
    key: 'compliance-exceptions',
    label: 'Compliance signals',
    value: summary.expiry.expired + summary.workforce.returnedWorkers,
    detail: `${summary.workforce.returnedWorkers} returned · ${summary.expiry.expired} expired`,
    tone: 'red',
  }),
  'registered-workers': (summary) => ({
    key: 'registered-workers',
    label: 'Registered workers',
    value: summary.portfolio.registeredWorkers,
    detail: 'Workers in the selected scope',
    tone: 'teal',
  }),
  projects: (summary) => ({
    key: 'projects',
    label: 'Projects',
    value: summary.portfolio.projects,
    detail: 'Projects in the selected scope',
    tone: 'blue',
  }),
  sites: (summary) => ({
    key: 'sites',
    label: 'Sites',
    value: summary.portfolio.sites,
    detail: 'Operational sites in scope',
    tone: 'green',
  }),
  'external-companies': (summary) => ({
    key: 'external-companies',
    label: 'Contractors & consultants',
    value: summary.portfolio.externalCompanies,
    detail: `${summary.portfolio.consultants} consultant companies included`,
    tone: 'amber',
  }),
  entries: (summary) => ({
    key: 'entries',
    label: 'Entries',
    value: summary.movements.entries,
    detail: 'Approved entries in this window',
    tone: 'green',
  }),
  exits: (summary) => ({
    key: 'exits',
    label: 'Exits',
    value: summary.movements.exits,
    detail: 'Recorded exits in this window',
    tone: 'blue',
  }),
  'denied-attempts': (summary) => ({
    key: 'denied-attempts',
    label: 'Denied attempts',
    value: summary.movements.denied,
    detail: 'Denied gate attempts in this window',
    tone: 'red',
  }),
};

export function getDashboardMetricCards(summary: DashboardMetricSummary): DashboardMetricCard[] {
  return (summary.audience.metricKeys ?? []).flatMap((key) => {
    const buildMetric = metricRegistry[key];
    return buildMetric ? [buildMetric(summary)] : [];
  });
}

export function getDashboardMetricGridClass(metricCount: number) {
  if (metricCount <= 1) return 'grid grid-cols-1 gap-3';
  if (metricCount === 2) return 'grid grid-cols-1 gap-3 sm:grid-cols-2';
  if (metricCount === 3) return 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3';
  if (metricCount === 4) return 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4';
  if (metricCount === 5) return 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5';
  return 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3';
}

export type PrimaryDashboardPanelKey = 'movement-activity' | 'clearance-pipeline';

export function getPrimaryDashboardPanelKeys(
  panelKeys: readonly string[],
  showAttendanceAnalytics: boolean,
): PrimaryDashboardPanelKey[] {
  const seen = new Set<string>();
  return panelKeys.filter((key): key is PrimaryDashboardPanelKey => {
    if (seen.has(key)) return false;
    if (key === 'movement-activity' && showAttendanceAnalytics) {
      seen.add(key);
      return true;
    }
    if (key === 'clearance-pipeline') {
      seen.add(key);
      return true;
    }
    return false;
  });
}

function decisionQueueDetail(item?: DashboardMetricSummary['actionQueue'][number]) {
  if (!item) return 'Access requests awaiting review';
  if (item.overdueCount > 0 && item.oldestAtUtc) {
    return `${item.overdueCount} overdue · oldest ${new Date(item.oldestAtUtc).toLocaleDateString()}`;
  }
  if (item.overdueCount > 0) return `${item.overdueCount} overdue`;
  if (item.oldestAtUtc) return `Oldest ${new Date(item.oldestAtUtc).toLocaleDateString()}`;
  return 'Access requests awaiting review';
}

export function getDashboardChartTitle(showAttendanceAnalytics: boolean) {
  return showAttendanceAnalytics ? 'Movement activity' : 'Clearance pipeline';
}

export function getWorkforceStatusData(input: {
  eligibleWorkers: number;
  clearedWorkers: number;
  submittedWorkers: number;
  underReviewWorkers: number;
  pendingWorkers: number;
  returnedWorkers: number;
}) {
  return [
    { name: 'Cleared', value: input.clearedWorkers },
    { name: 'Under review', value: input.underReviewWorkers },
    { name: 'Submitted', value: input.submittedWorkers },
    { name: 'Pending', value: input.pendingWorkers },
    { name: 'Returned', value: input.returnedWorkers },
  ].filter((status) => status.value > 0);
}

export function getDashboardTrendSeries<T extends {
  date: string;
  movements: number;
  entries: number;
  exits: number;
  denied: number;
}>(points: T[], maxPoints = 14): T[] {
  if (points.length <= maxPoints || maxPoints < 1) return points;

  const bucketSize = Math.ceil(points.length / maxPoints);
  const buckets: T[] = [];
  for (let start = 0; start < points.length; start += bucketSize) {
    const bucket = points.slice(start, start + bucketSize);
    const first = bucket[0];
    const last = bucket[bucket.length - 1];
    buckets.push({
      ...first,
      date: first.date === last.date ? first.date : `${first.date}–${last.date}`,
      movements: bucket.reduce((sum, point) => sum + point.movements, 0),
      entries: bucket.reduce((sum, point) => sum + point.entries, 0),
      exits: bucket.reduce((sum, point) => sum + point.exits, 0),
      denied: bucket.reduce((sum, point) => sum + point.denied, 0),
    });
  }
  return buckets;
}

export function getRankedSiteBreakdown(sites: Array<{ name: string; count: number }>, maxSites = 5) {
  const ranked = [...sites].sort((left, right) => right.count - left.count);
  const visible = ranked.slice(0, maxSites);
  const otherCount = ranked.slice(maxSites).reduce((sum, site) => sum + site.count, 0);
  if (otherCount > 0) visible.push({ name: 'Other sites', count: otherCount });
  return visible;
}
