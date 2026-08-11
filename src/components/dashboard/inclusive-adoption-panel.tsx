'use client';

import type { DashboardSummary } from '@/lib/api';

export function InclusiveAdoptionPanel({ summary }: { summary: DashboardSummary | null }) {
  const adoption = summary?.adoption;
  return (
    <section className="ops-panel p-5">
      <h2 className="text-sm font-semibold text-foreground">Inclusive adoption</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Delivery support needs only—not worker performance or access-decision inputs. Small groups are combined for privacy.
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <AdoptionMetric label="Managed profiles" value={adoption?.managedProfiles} />
        <AdoptionMetric label="Assisted workflows" value={adoption?.assistedWorkflowWorkers} />
        <AdoptionMetric label="No personal device" value={adoption?.workersWithoutPersonalDevice} />
        <AdoptionMetric label="Offline card needed" value={adoption?.offlineCardRequiredWorkers} />
        <AdoptionMetric label="Interactive accounts" value={adoption?.interactiveAccounts} />
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        {(adoption?.registrationChannels ?? []).map((channel) => (
          <span key={channel.id} className="rounded-full border border-border bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground">
            {channel.name}: {channel.count}
          </span>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Groups below {adoption?.minimumGroupSize ?? 5} people are shown as “Other / private”.
      </p>
    </section>
  );
}

function AdoptionMetric({ label, value }: { label: string; value?: number | null }) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-xl font-bold tabular-nums text-foreground">{value ?? 'Private'}</dd>
    </div>
  );
}
