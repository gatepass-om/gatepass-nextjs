'use client';

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { InspectionAnalytics } from '@/lib/inspections-api';

const OUTCOME_COLORS = ['hsl(var(--success))', 'hsl(var(--destructive))'];

export function InspectionCharts({ analytics }: { analytics: InspectionAnalytics }) {
  const outcomes = [
    { name: 'Compliant', value: analytics.compliantInspections },
    { name: 'Non-compliant', value: analytics.nonCompliantInspections },
  ];
  const reasons = analytics.commonWrongfulConductReasons.slice(0, 7);

  return (
    <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
      <section className="rounded-xl border bg-card p-5" aria-label="Inspection outcomes">
        <div>
          <h2 className="font-semibold">Inspection outcomes</h2>
          <p className="text-sm text-muted-foreground">Compliant versus non-compliant findings.</p>
        </div>
        <div className="h-72">
          {analytics.totalInspections === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No inspection outcomes in this period.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={outcomes} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={3}>
                  {outcomes.map((entry, index) => <Cell key={entry.name} fill={OUTCOME_COLORS[index]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {outcomes.map((outcome, index) => (
            <div key={outcome.name} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
              <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: OUTCOME_COLORS[index] }} />{outcome.name}</span>
              <strong>{outcome.value.toLocaleString()}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border bg-card p-5" aria-label="Common wrongful conduct reasons">
        <div>
          <h2 className="font-semibold">Common wrongful conduct</h2>
          <p className="text-sm text-muted-foreground">Most frequent reasons recorded during non-compliant inspections.</p>
        </div>
        <div className="mt-4 h-80">
          {reasons.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No wrongful conduct recorded in this period.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reasons} layout="vertical" margin={{ left: 12, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="reason" width={130} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => [`${value} inspections`, 'Count']} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 5, 5, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>
    </div>
  );
}
