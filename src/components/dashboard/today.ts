import type { DashboardSummary } from '../../lib/api';

export type TodayTone = 'default' | 'warning' | 'danger';

export type TodayTask = {
  key: string;
  title: string;
  overdue: number;
  href: string;
  count: number;
  tone: TodayTone;
};

const toneRank: Record<TodayTone, number> = { danger: 0, warning: 1, default: 2 };

/** The summary's action queue, minus what does not apply or is empty, most urgent first. */
export function buildTodayTasks(
  queue: DashboardSummary['actionQueue'],
  extra: { pendingSubcontractors?: number } = {},
): TodayTask[] {
  const tasks: TodayTask[] = queue
    .filter((item) => item.applicable && item.count > 0)
    .map((item) => ({
      key: item.key,
      title: item.label,
      count: item.count,
      href: item.href,
      tone: item.severity === 'danger' ? 'danger' : item.severity === 'warning' ? 'warning' : 'default',
      overdue: item.overdueCount,
    }));
  if (extra.pendingSubcontractors && extra.pendingSubcontractors > 0) {
    tasks.push({
      key: 'subcontractor-registrations',
      title: 'Subcontractor registrations to review',
      count: extra.pendingSubcontractors,
      href: '/companies',
      tone: 'warning',
      overdue: 0,
    });
  }
  return tasks
    .map((task, position) => ({ task, position }))
    .sort((a, b) => toneRank[a.task.tone] - toneRank[b.task.tone] || a.position - b.position)
    .map(({ task }) => task);
}

export type GateRow = {
  id: string;
  name: string;
  occurredAtUtc: string;
  detail: string;
  outcome: 'in' | 'out' | 'denied';
};

type RawGateRow = {
  id: string;
  userName: string;
  gateName?: string | null;
  activityType: string;
  decisionOutcome?: string | null;
  failureReason?: string | null;
  occurredAtUtc: string;
};

/** Newest first. A denied decision shows its reason; otherwise the gate it happened at. */
export function toGateRows(rows: RawGateRow[], limit = 8): GateRow[] {
  return [...rows]
    .sort((a, b) => b.occurredAtUtc.localeCompare(a.occurredAtUtc))
    .slice(0, limit)
    .map((row) => {
      const denied = row.decisionOutcome === 'Denied';
      return {
        id: row.id,
        name: row.userName,
        occurredAtUtc: row.occurredAtUtc,
        detail: denied ? row.failureReason || 'Denied' : row.gateName || '',
        outcome: denied ? 'denied' : row.activityType === 'CheckOut' ? 'out' : 'in',
      };
    });
}

export type ExpiryRow = { key: string; label: string; value: number; tone: TodayTone; href: string };

export function toExpiryRows(expiry: DashboardSummary['expiry']): ExpiryRow[] {
  return [
    { key: 'expired', label: 'Expired', value: expiry.expired, tone: 'danger' as const, href: '/users?credentialStatus=Expired' },
    { key: 'week', label: 'Next 7 days', value: expiry.next7Days, tone: 'warning' as const, href: '/users?credentialStatus=Expiring' },
    { key: 'month', label: '8 to 30 days', value: expiry.days8To30, tone: 'default' as const, href: '/users?credentialStatus=Expiring' },
  ].filter((row) => row.value > 0);
}

export function startOfDay(now: Date): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start;
}
