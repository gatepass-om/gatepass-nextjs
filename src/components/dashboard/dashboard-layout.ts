export type DashboardMetricSummary = {
  totalOnSite: number;
  movements: { entries: number; exits: number; total: number };
  pendingRequests: number;
  deniedRequests: number;
  expiry: { expired: number };
  workforce: { clearedWorkers: number; readinessRate: number };
};

export type DashboardMetricCard = {
  label: string;
  value: number | string;
  detail: string;
  tone: 'teal' | 'blue' | 'amber' | 'green' | 'red';
};

export function getDashboardMetricCards(
  summary: DashboardMetricSummary,
  showAttendanceAnalytics: boolean,
): DashboardMetricCard[] {
  const cards: DashboardMetricCard[] = [
    {
      label: 'On site',
      value: summary.totalOnSite,
      detail: 'people currently present',
      tone: 'teal',
    },
    {
      label: 'Movement volume',
      value: summary.movements.total,
      detail: `${summary.movements.entries} in · ${summary.movements.exits} out`,
      tone: 'blue',
    },
    {
      label: 'Pending decisions',
      value: summary.pendingRequests,
      detail: 'access requests to review',
      tone: 'amber',
    },
    {
      label: 'Readiness',
      value: `${summary.workforce.readinessRate}%`,
      detail: `${summary.workforce.clearedWorkers} workers cleared`,
      tone: 'green',
    },
    {
      label: 'Exceptions',
      value: summary.deniedRequests + summary.expiry.expired,
      detail: `${summary.deniedRequests} denied · ${summary.expiry.expired} expired`,
      tone: 'red',
    },
  ];

  return showAttendanceAnalytics
    ? cards
    : cards.filter((card) => card.label !== 'On site' && card.label !== 'Movement volume');
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
