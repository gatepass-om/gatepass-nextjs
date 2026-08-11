'use client';

import type { DashboardSummary } from '@/lib/api';

export function RegistrationFunnelPanel({ summary }: { summary: DashboardSummary | null }) {
  const funnel = summary?.registrationFunnel;
  const cohort = funnel?.cohortWorkers ?? 0;
  const stages = [
    ['Registered', funnel?.cohortWorkers, 'A worker record was created'],
    ['Profile ready', funnel?.profileCompletedWorkers, 'Basic worker details are complete'],
    ['Evidence started', funnel?.evidenceStartedWorkers, 'At least one document was added'],
    ['Submitted', funnel?.submittedWorkers, 'Sent to the review team'],
    ['In review', funnel?.underReviewWorkers, 'Review work has started'],
    ['Cleared', funnel?.clearedWorkers, 'Compliance review was completed'],
  ] as const;

  return (
    <section className="ops-panel p-5">
      <h2 className="text-sm font-semibold text-foreground">Registration progress</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Shows where a registration needs help. It does not track clicks, devices, location, or individual performance.
      </p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        <Rate label="Submitted rate" value={funnel?.submissionRate} />
        <Rate label="Clearance rate" value={funnel?.clearanceRate} />
        <Rate label="May need follow-up" value={funnel?.stalledBeforeSubmissionWorkers} suffix="" />
      </dl>

      {funnel?.privacySuppressed || !funnel ? (
        <div className="mt-3 rounded-lg border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
          Counts are private until at least {funnel?.minimumGroupSize ?? 5} workers register in the selected period.
        </div>
      ) : (
        <>
          <ol className="mt-5 space-y-3">
            {stages.map(([label, value, help]) => {
              const width = cohort > 0 && value != null
                ? Math.max(3, Math.round(value * 100 / cohort))
                : 0;
              return (
                <li key={label}>
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{label}</p>
                      <p className="text-[11px] text-muted-foreground">{help}</p>
                    </div>
                    <span className="text-sm font-bold tabular-nums text-foreground">{value ?? 'Private'}</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="mt-4 text-[11px] text-muted-foreground">
            “May need follow-up” means no submission after seven days. Returned registrations: {funnel.returnedWorkers ?? 0}.
            {funnel.coverageStartedAtUtc ? ` Tracking began ${new Date(funnel.coverageStartedAtUtc).toLocaleDateString()}.` : ''}
          </p>
        </>
      )}
    </section>
  );
}

function Rate({
  label,
  value,
  suffix = '%',
}: {
  label: string;
  value?: number | null;
  suffix?: string;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-xl font-bold tabular-nums text-foreground">
        {value == null ? 'Private' : `${value}${suffix}`}
      </dd>
    </div>
  );
}
