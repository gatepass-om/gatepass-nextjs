'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronRight, ScanLine } from 'lucide-react';
import { useAuthProtection } from '@/hooks/use-auth-protection';
import { apiRequest, fetchDashboardSummaryRequest, type DashboardSummary } from '@/lib/api';
import { usePolling } from '@/lib/polling';
import { useLocale } from '@/providers/locale-provider';
import { getNavigationForRole } from '@/components/layout/sidebar-navigation';
import { buildTodayTasks, startOfDay, toExpiryRows, toGateRows, type GateRow } from '@/components/dashboard/today';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { StatStrip } from '@/components/ui/stat-strip';
import { useSession } from '@/providers/session-provider';

// The gate feed is a separate, narrower permission; other roles fall back to the summary's recent movements.
const GATE_FEED_ROLES = ['Admin', 'Operator Admin', 'Manager'];
const SUBCONTRACTOR_REVIEW_ROLES = ['Admin', 'Operator Admin'];

type SiteOption = { id: string; name: string };

export default function TodayPage() {
  const { currentUser, isAuthorized, UnauthorizedComponent } = useAuthProtection([
    'Admin', 'Operator Admin', 'Manager', 'Supervisor', 'Contractor Admin', 'Security', 'Inspector',
  ]);
  const { token } = useSession();
  const { locale, t } = useLocale();
  const role = currentUser?.role;

  const [siteId, setSiteId] = useState('all');
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [gate, setGate] = useState<GateRow[]>([]);
  const [pendingSubcontractors, setPendingSubcontractors] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token || !role) return;
    try {
      const now = new Date();
      const gateQuery = `/gate/activity?limit=8${siteId !== 'all' ? `&siteId=${encodeURIComponent(siteId)}` : ''}`;
      const [nextSummary, gateRows, companies] = await Promise.all([
        fetchDashboardSummaryRequest(token, { siteId, fromUtc: startOfDay(now).toISOString(), toUtc: now.toISOString() }),
        GATE_FEED_ROLES.includes(role)
          ? apiRequest<Parameters<typeof toGateRows>[0]>(gateQuery, { token }).catch(() => null)
          : Promise.resolve(null),
        SUBCONTRACTOR_REVIEW_ROLES.includes(role)
          ? apiRequest<Array<{ approvalStatus?: string }>>('/companies/contractors', { token }).catch(() => [])
          : Promise.resolve([]),
      ]);
      setSummary(nextSummary);
      if (siteId === 'all') setSites(nextSummary.mapSites.map((site) => ({ id: site.siteId, name: site.siteName })));
      setGate(toGateRows(gateRows ?? nextSummary.recentActivity.map((row) => ({ ...row, id: row.id, userName: row.userName })), 8));
      setPendingSubcontractors(companies.filter((company) => company.approvalStatus === 'PendingOperatorApproval').length);
      setError('');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : t('Could not load today.'));
    } finally {
      setLoading(false);
    }
  }, [token, role, siteId, t]);

  useEffect(() => { void load(); }, [load]);
  usePolling(() => { void load(); }, 45_000);

  const tasks = useMemo(
    () => buildTodayTasks(summary?.actionQueue ?? [], { pendingSubcontractors }),
    [summary, pendingSubcontractors],
  );
  const expiry = useMemo(() => (summary ? toExpiryRows(summary.expiry) : []), [summary]);
  const canScan = !!role && getNavigationForRole(role).some((item) => item.href === '/card-verification');
  const clock = useMemo(
    () => new Intl.DateTimeFormat(locale === 'ar' ? 'ar-OM' : 'en-GB', { hour: '2-digit', minute: '2-digit' }),
    [locale],
  );

  if (!currentUser) return null;
  if (!isAuthorized) return <UnauthorizedComponent />;

  const outcomePill = { in: 'success', out: 'secondary', denied: 'destructive' } as const;
  const outcomeLabel = { in: 'In', out: 'Out', denied: 'Denied' } as const;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{t('Today')}</h1>
          {sites.length > 1 ? (
            <Select value={siteId} onValueChange={(value) => { setLoading(true); setSiteId(value); }}>
              <SelectTrigger className="h-9 w-auto min-w-[11rem]" aria-label={t('Site')}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('All sites')}</SelectItem>
                {sites.map((site) => <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : sites.length === 1 ? <span className="text-sm text-muted-foreground">{sites[0].name}</span> : null}
        </div>
        {canScan ? (
          <Button asChild className="hidden md:inline-flex">
            <Link href="/card-verification"><ScanLine className="me-2 h-4 w-4" />{t('Scan badge')}</Link>
          </Button>
        ) : null}
      </div>

      {summary ? (
        <StatStrip items={[
          { label: t('on site'), value: summary.totalOnSite },
          { label: t('blocked today'), value: summary.movements.denied, tone: 'danger' },
          { label: t('need you'), value: tasks.reduce((sum, task) => sum + task.count, 0), tone: 'warning' },
          { label: t('expiring this week'), value: summary.expiry.next7Days, tone: 'warning' },
        ]} />
      ) : null}

      {error ? (
        <p role="alert" className="flex items-center gap-3 text-sm text-danger-ink">
          {error}
          <Button variant="outline" size="sm" onClick={() => void load()}>{t('Retry')}</Button>
        </p>
      ) : null}

      {loading && !summary ? (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : summary ? (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Card className="overflow-hidden">
            {tasks.length > 0 ? (
              <ul className="divide-y divide-border">
                {tasks.map((task) => (
                  <li key={task.key} className="flex items-center justify-between gap-4 px-5 py-4">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-medium">
                        {task.tone !== 'default' ? <span className={`status-dot ${task.tone === 'danger' ? 'bg-danger' : 'bg-warning'}`} aria-hidden="true" /> : null}
                        {t(task.title)}
                      </p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {task.count} {t('waiting')}{task.overdue > 0 ? ` · ${task.overdue} ${t('overdue')}` : ''}
                      </p>
                    </div>
                    <Button asChild variant="outline" size="sm" className="shrink-0">
                      <Link href={task.href}>{t('Open')}</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 px-5 py-12 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
                {t('Nothing needs you right now')}
              </p>
            )}
          </Card>

          <div className="min-w-0 space-y-4">
            <Card className="p-5">
              <h2 className="text-base font-semibold">{t('At the gate')}</h2>
              {gate.length > 0 ? (
                <ul className="mt-3 divide-y divide-border">
                  {gate.map((row) => (
                    <li key={row.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{row.name}</p>
                        <p className="truncate text-xs text-muted-foreground"><span>{clock.format(new Date(row.occurredAtUtc))}</span>{row.detail ? <> · <span>{t(row.detail)}</span></> : null}</p>
                      </div>
                      <Badge variant={outcomePill[row.outcome]}>{t(outcomeLabel[row.outcome])}</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">{t('No gate activity yet')}</p>
              )}
            </Card>

            {expiry.length > 0 ? (
              <Card className="p-5">
                <h2 className="text-base font-semibold">{t('Expiring soon')}</h2>
                <ul className="mt-3 divide-y divide-border">
                  {expiry.map((row) => (
                    <li key={row.key}>
                      <Link href={row.href} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-foreground">
                        <span>{t(row.label)}</span>
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <span className="font-semibold tabular-nums text-foreground">{row.value}</span>
                          <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
