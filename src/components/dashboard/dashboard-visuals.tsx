'use client';

import type { ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  Clock3,
  LogIn,
  ShieldAlert,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { DashboardSummary } from '@/lib/api';
import {
  getDashboardChartTitle,
  getDashboardMetricCards,
  getDashboardTrendSeries,
  getRankedSiteBreakdown,
  getWorkforceStatusData,
} from './dashboard-layout';

type DashboardVisualsProps = {
  summary: DashboardSummary | null;
  isLoading: boolean;
  showAttendanceAnalytics: boolean;
};

const COLORS = {
  teal: 'hsl(164 56% 37%)',
  tealSoft: 'hsl(164 56% 37% / .12)',
  ink: 'hsl(220 28% 16%)',
  blue: 'hsl(199 75% 46%)',
  green: 'hsl(151 52% 40%)',
  amber: 'hsl(36 92% 55%)',
  red: 'hsl(0 72% 55%)',
  grid: 'hsl(var(--border) / .7)',
};

const METRIC_ICONS: Record<string, LucideIcon> = {
  'On site': UsersRound,
  'Movement volume': LogIn,
  'Pending decisions': Clock3,
  Readiness: BadgeCheck,
  Exceptions: ShieldAlert,
};

const METRIC_TONES = {
  teal: { icon: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500' },
  blue: { icon: 'bg-sky-100 text-sky-700', bar: 'bg-sky-500' },
  amber: { icon: 'bg-amber-100 text-amber-700', bar: 'bg-amber-500' },
  green: { icon: 'bg-green-100 text-green-700', bar: 'bg-green-500' },
  red: { icon: 'bg-rose-100 text-rose-700', bar: 'bg-rose-500' },
} as const;

export function DashboardVisuals({ summary, isLoading, showAttendanceAnalytics }: DashboardVisualsProps) {
  const safeSummary = summary ?? emptySummary;
  const metrics = getDashboardMetricCards(safeSummary, showAttendanceAnalytics);
  const decisionData = [
    { name: 'Approved', value: safeSummary.approvedRequests, color: COLORS.green },
    { name: 'Pending', value: safeSummary.pendingRequests, color: COLORS.amber },
    { name: 'Denied', value: safeSummary.deniedRequests, color: COLORS.red },
  ];
  const decisionTotal = decisionData.reduce((total, item) => total + item.value, 0);
  const workforceData = [
    { name: 'Cleared', value: safeSummary.workforce.clearedWorkers, color: COLORS.green },
    { name: 'Under review', value: safeSummary.workforce.underReviewWorkers, color: COLORS.blue },
    { name: 'Submitted', value: safeSummary.workforce.submittedWorkers, color: COLORS.teal },
    { name: 'Pending', value: safeSummary.workforce.pendingWorkers, color: COLORS.amber },
    { name: 'Returned', value: safeSummary.workforce.returnedWorkers, color: COLORS.red },
  ];
  const workforceTotal = workforceData.reduce((total, item) => total + item.value, 0);
  const rankedSites = getRankedSiteBreakdown(safeSummary.sites, 5);
  const expiryData = [
    { name: 'Expired', value: safeSummary.expiry.expired, fill: COLORS.red },
    { name: 'Next 7 days', value: safeSummary.expiry.next7Days, fill: COLORS.amber },
    { name: '8–30 days', value: safeSummary.expiry.days8To30, fill: COLORS.blue },
    { name: '31–60 days', value: safeSummary.expiry.days31To60, fill: COLORS.green },
  ];
  const workforceStatusData = getWorkforceStatusData(safeSummary.workforce);
  const trendData = getDashboardTrendSeries(safeSummary.trends);

  return (
    <div className="space-y-4">
      <section aria-label="Key operational metrics" className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${metrics.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-3 xl:grid-cols-5'}`}>
        {metrics.map((metric) => {
          const Icon = METRIC_ICONS[metric.label] ?? BadgeCheck;
          const tone = METRIC_TONES[metric.tone];
          return (
            <article key={metric.label} className="dashboard-metric group">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="dashboard-eyebrow">{metric.label}</p>
                  {isLoading ? <Skeleton className="mt-2 h-8 w-16" /> : <p className="mt-1 text-[28px] font-semibold leading-none tracking-[-.04em] text-slate-900">{typeof metric.value === 'number' ? metric.value.toLocaleString() : metric.value}</p>}
                </div>
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone.icon}`}><Icon className="h-[18px] w-[18px]" /></span>
              </div>
              <p className="mt-3 truncate text-[11px] text-slate-500">{metric.detail}</p>
              <span className={`mt-3 block h-1 w-full rounded-full bg-slate-100 after:block after:h-1 after:w-2/3 after:rounded-full ${tone.bar}`} aria-hidden="true" />
            </article>
          );
        })}
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(19rem,.75fr)]">
        <DashboardPanel
          title={getDashboardChartTitle(showAttendanceAnalytics)}
          subtitle={showAttendanceAnalytics ? `${safeSummary.trends.length > 14 ? 'Aggregated ' : ''}entries, exits and denied attempts across the selected window` : `${safeSummary.workforce.eligibleWorkers} eligible workers by clearance status`}
          trailing={<span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">LIVE</span>}
        >
          {isLoading ? <Skeleton className="h-[268px] w-full rounded-xl" /> : showAttendanceAnalytics ? (
            <div className="h-[268px] min-h-0 w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} initialDimension={{ width: 640, height: 268 }}>
                <AreaChart data={trendData} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dashboardEntries" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={COLORS.teal} stopOpacity={.28} /><stop offset="95%" stopColor={COLORS.teal} stopOpacity={.02} /></linearGradient>
                    <linearGradient id="dashboardExits" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={COLORS.blue} stopOpacity={.18} /><stop offset="95%" stopColor={COLORS.blue} stopOpacity={.02} /></linearGradient>
                  </defs>
                  <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 5" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={formatTrendDate} tickLine={false} axisLine={false} fontSize={10} tick={{ fill: '#94a3b8' }} />
                  <YAxis tickLine={false} axisLine={false} fontSize={10} allowDecimals={false} tick={{ fill: '#94a3b8' }} />
                  <Tooltip cursor={false} contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="entries" name="Entries" stroke={COLORS.teal} fill="url(#dashboardEntries)" strokeWidth={2.5} dot={false} />
                  <Area type="monotone" dataKey="exits" name="Exits" stroke={COLORS.blue} fill="url(#dashboardExits)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="denied" name="Denied" stroke={COLORS.red} fill="transparent" strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[268px] min-h-0 w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} initialDimension={{ width: 640, height: 268 }}>
                <BarChart data={workforceStatusData} margin={{ top: 24, right: 8, left: -18, bottom: 0 }} barCategoryGap="22%">
                  <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 5" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={10} tick={{ fill: '#64748b' }} interval={0} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={10} tick={{ fill: '#94a3b8' }} />
                  <Tooltip cursor={false} contentStyle={tooltipStyle} />
                  <Bar dataKey="value" name="Workers" radius={[5, 5, 0, 0]} maxBarSize={72}>
                    {workforceStatusData.map((item) => <Cell key={item.name} fill={workforceColor(item.name)} />)}
                    <LabelList dataKey="value" position="top" fill="#64748b" fontSize={10} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-slate-500">
            {showAttendanceAnalytics ? <><LegendDot color={COLORS.teal} label="Entries" /><LegendDot color={COLORS.blue} label="Exits" /><LegendDot color={COLORS.red} label="Denied" /></> : <><LegendDot color={COLORS.green} label="Cleared" /><LegendDot color={COLORS.blue} label="Under review" /><LegendDot color={COLORS.teal} label="Submitted" /><LegendDot color={COLORS.amber} label="Pending" /><LegendDot color={COLORS.red} label="Returned" /></>}
          </div>
        </DashboardPanel>

        <DashboardPanel title="Decision health" subtitle="How access requests are moving through review">
          <div className="grid grid-cols-[150px_minmax(0,1fr)] items-center gap-3">
            <DonutChart data={decisionData} total={decisionTotal} centerValue={decisionTotal.toLocaleString()} centerLabel="decisions" emptyLabel="No requests" size="small" />
            <div className="space-y-3">
              {decisionData.map((item) => <BreakdownRow key={item.name} color={item.color} label={item.name} value={item.value} total={decisionTotal} />)}
            </div>
          </div>
          <div className="mt-4 rounded-xl bg-slate-50 px-3 py-2.5 text-[11px] text-slate-500">Approval rate <span className="float-right font-semibold text-slate-800">{safeSummary.comparison.currentApprovalRate}%</span></div>
        </DashboardPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,.8fr)]">
        <DashboardPanel title={showAttendanceAnalytics ? 'Site pulse' : 'Workforce readiness'} subtitle={showAttendanceAnalytics ? 'People currently present by site' : 'Clearance mix for the visible workforce'} trailing={showAttendanceAnalytics ? <span className="text-[11px] font-medium text-slate-400">Top 5 sites</span> : undefined}>
          {showAttendanceAnalytics ? (
            rankedSites.length === 0 ? <EmptyChart label="No personnel currently on site" /> : <div className="space-y-3 pt-1">{rankedSites.map((site, index) => <SiteBar key={site.name} name={site.name} value={site.count} max={rankedSites[0]?.count ?? 1} rank={index + 1} />)}</div>
            ) : <DonutChart data={workforceData} total={workforceTotal} centerValue={`${safeSummary.workforce.readinessRate}%`} centerLabel="cleared" emptyLabel="No workers" />}
        </DashboardPanel>

        <DashboardPanel title="Credential watch" subtitle="Certificates and credentials needing attention">
          <div className="h-[220px] min-h-0 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} initialDimension={{ width: 420, height: 220 }}>
              <BarChart data={expiryData} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={9} tick={{ fill: '#64748b' }} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={10} tick={{ fill: '#94a3b8' }} />
                <Tooltip cursor={false} contentStyle={tooltipStyle} />
                <Bar dataKey="value" name="Credentials" radius={[5, 5, 0, 0]}>{expiryData.map((item) => <Cell key={item.name} fill={item.fill} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DashboardPanel>
      </div>
    </div>
  );
}

const emptySummary = {
  totalOnSite: 0,
  movements: { entries: 0, exits: 0, denied: 0, manualOverrides: 0, total: 0 },
  pendingRequests: 0,
  approvedRequests: 0,
  deniedRequests: 0,
  comparison: { currentApprovalRate: 0 },
  expiry: { expired: 0, next7Days: 0, days8To30: 0, days31To60: 0, days61To90: 0 },
  workforce: { eligibleWorkers: 0, pendingWorkers: 0, submittedWorkers: 0, underReviewWorkers: 0, clearedWorkers: 0, returnedWorkers: 0, readinessRate: 0 },
  trends: [],
  sites: [],
} as unknown as DashboardSummary;

const tooltipStyle = { borderRadius: 12, border: '1px solid hsl(var(--border))', boxShadow: '0 8px 24px rgb(15 23 42 / .08)', fontSize: 11 };

function formatTrendDate(value: string) {
  const firstDate = value.split('–')[0] ?? value;
  return firstDate.slice(5);
}

function workforceColor(status: string) {
  if (status === 'Cleared') return COLORS.green;
  if (status === 'Under review') return COLORS.blue;
  if (status === 'Submitted') return COLORS.teal;
  if (status === 'Pending') return COLORS.amber;
  return COLORS.red;
}

function DashboardPanel({ title, subtitle, trailing, children }: { title: string; subtitle: string; trailing?: ReactNode; children: ReactNode }) {
  return <section className="dashboard-panel"><header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><h2 className="text-[14px] font-semibold tracking-[-.01em] text-slate-900">{title}</h2><p className="mt-1 text-[11px] leading-4 text-slate-400">{subtitle}</p></div>{trailing}</header><div className="p-5">{children}</div></section>;
}

function LegendDot({ color, label }: { color: string; label: string }) { return <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />{label}</span>; }

function BreakdownRow({ color, label, value, total }: { color: string; label: string; value: number; total: number }) {
  const percentage = total ? Math.round((value / total) * 100) : 0;
  return <div><div className="flex items-center justify-between text-[11px]"><span className="inline-flex items-center gap-1.5 text-slate-500"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />{label}</span><span className="font-semibold tabular-nums text-slate-800">{value}</span></div><div className="mt-1 h-1 rounded-full bg-slate-100"><span className="block h-1 rounded-full" style={{ width: `${percentage}%`, backgroundColor: color }} /></div></div>;
}

function SiteBar({ name, value, max, rank }: { name: string; value: number; max: number; rank: number }) {
  return <div className="flex items-center gap-3"><span className="w-4 text-[10px] font-semibold tabular-nums text-slate-300">0{rank}</span><span className="w-28 truncate text-[11px] font-medium text-slate-600">{name}</span><span className="h-2 flex-1 rounded-full bg-slate-100"><span className="block h-2 rounded-full bg-emerald-500" style={{ width: `${Math.max(4, (value / max) * 100)}%` }} /></span><span className="w-8 text-right text-[11px] font-semibold tabular-nums text-slate-800">{value}</span></div>;
}

function DonutChart({ data, total, centerValue, centerLabel, emptyLabel, size = 'large' }: { data: Array<{ name: string; value: number; color: string }>; total: number; centerValue: string; centerLabel: string; emptyLabel: string; size?: 'small' | 'large' }) {
  const chartData = total > 0 ? data : [{ name: emptyLabel, value: 1, color: '#e2e8f0' }];
  const innerRadius = size === 'small' ? 42 : 58;
  const outerRadius = size === 'small' ? 62 : 82;
  return <div className={`relative ${size === 'small' ? 'h-[150px]' : 'h-[220px]'}`}><ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} initialDimension={{ width: size === 'small' ? 150 : 320, height: size === 'small' ? 150 : 220 }}><PieChart><Pie data={chartData} dataKey="value" innerRadius={innerRadius} outerRadius={outerRadius} paddingAngle={total > 0 ? 4 : 0} stroke="transparent">{chartData.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie></PieChart></ResponsiveContainer><div className={`pointer-events-none absolute inset-x-0 text-center ${size === 'small' ? 'top-[52px]' : 'top-[76px]'}`}><p className="text-[22px] font-semibold tracking-[-.04em] text-slate-900">{centerValue}</p><p className="text-[10px] text-slate-400">{total > 0 ? centerLabel : emptyLabel}</p></div></div>;
}

function EmptyChart({ label }: { label: string }) { return <div className="flex h-[220px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 text-[11px] text-slate-400">{label}</div>; }
