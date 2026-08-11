'use client';

import type { DashboardSummary } from '@/lib/api';

type Props = {
  summary: DashboardSummary | null;
};

export function ManagementScorecards({ summary }: Props) {
  return (
    <section className="grid gap-6 xl:grid-cols-2">
      <div className="ops-panel p-5">
        <h2 className="text-sm font-semibold text-foreground">Contractor readiness</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Uses the same eligible-workforce denominator as the main compliance rate.
        </p>
        <div className="mt-4 space-y-3">
          {(summary?.contractorScorecards ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No contractor workforce is linked to this scope.</p>
          ) : summary?.contractorScorecards.map((contractor) => (
            <div key={contractor.id} className="rounded-lg border border-border/70 bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-sm font-medium text-foreground">{contractor.name}</span>
                <span className="text-sm font-semibold tabular-nums">{contractor.readinessRate}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-success" style={{ width: `${contractor.readinessRate}%` }} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {contractor.clearedWorkers}/{contractor.eligibleWorkers} ready · {contractor.onSiteWorkers} on site ·{' '}
                {contractor.pendingDocumentWorkers} awaiting documents
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="ops-panel p-5">
        <h2 className="text-sm font-semibold text-foreground">Projects and credentials</h2>
        <p className="mt-1 text-xs text-muted-foreground">Active work passes plus competency and card production health.</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Metric label="Verified competencies" value={summary?.competencies.verified ?? 0} />
          <Metric label="Expired competencies" value={summary?.competencies.expired ?? 0} tone="danger" />
          <Metric label="Cards printed" value={summary?.cards.printed ?? 0} />
          <Metric label="Workers missing cards" value={summary?.cards.missing ?? 0} tone="warning" />
        </div>
        <div className="mt-4 space-y-2">
          {(summary?.projectScorecards ?? []).map((project) => (
            <div key={project.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-foreground">{project.name}</span>
                <span className="block text-xs text-muted-foreground">{project.members} members · {project.status}</span>
              </span>
              <span className="shrink-0 text-xs font-semibold">{project.activeWorkPasses}/{project.workPasses} active passes</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value, tone = 'default' }: { label: string; value: number; tone?: 'default' | 'warning' | 'danger' }) {
  const toneClass = tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-foreground';
  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
      <div className={`text-xl font-bold tabular-nums ${toneClass}`}>{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
