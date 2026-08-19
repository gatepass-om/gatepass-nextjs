'use client';

import { useEffect, useState } from 'react';
import { BookOpen, Download, Save } from 'lucide-react';
import type { DashboardSummary } from '@/lib/api';

export type ReportingWindow = '24h' | '7d' | '30d' | 'custom';
type SavedView = {
  id: string;
  name: string;
  operatorId: string;
  siteId: string;
  reportingWindow: ReportingWindow;
  customFromLocal?: string;
  customToLocal?: string;
};

type Props = {
  summary: DashboardSummary | null;
  showAttendanceAnalytics: boolean;
  operatorId: string;
  siteId: string;
  reportingWindow: ReportingWindow;
  customFromLocal: string;
  customToLocal: string;
  onApplyView: (view: Omit<SavedView, 'id' | 'name'>) => void;
};

const STORAGE_KEY = 'gatepass.dashboard.saved-views.v1';

const glossary = [
  ['On site now', 'People whose latest recorded presence is on site.'],
  ['Active approvals', 'Approved requests valid at the dashboard “as of” time.'],
  ['Workforce readiness', 'Cleared workers divided by all workers linked to the selected sites.'],
  ['Movements', 'Actual check-in, check-out, and denied gate events inside the selected window.'],
  ['Compliance-only site', 'A site that records evidence but does not require access authorization.'],
  ['Registration cohort', 'Workers whose records were created inside the selected reporting window.'],
  ['Submitted rate', 'Registration cohort workers submitted for review, divided by the whole cohort.'],
  ['May need follow-up', 'Workers in the cohort who have not submitted after seven days. This is a support prompt, not a performance score.'],
  ['Data freshness', 'The server time when the dashboard result was generated.'],
];

export function DashboardTools({
  summary,
  showAttendanceAnalytics,
  operatorId,
  siteId,
  reportingWindow,
  customFromLocal,
  customToLocal,
  onApplyView,
}: Props) {
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [showGlossary, setShowGlossary] = useState(false);

  useEffect(() => {
    setSavedViews(readSavedViews());
  }, []);

  function saveCurrentView() {
    const view: SavedView = {
      id: crypto.randomUUID(),
      name: `${reportingWindow === 'custom' ? 'Custom range' : reportingWindow} · ${siteId === 'all' ? 'All sites' : 'Selected site'}`,
      operatorId,
      siteId,
      reportingWindow,
      customFromLocal: reportingWindow === 'custom' ? customFromLocal : undefined,
      customToLocal: reportingWindow === 'custom' ? customToLocal : undefined,
    };
    const next = [view, ...savedViews].slice(0, 10);
    setSavedViews(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // The view remains usable for this session when storage is blocked or full.
    }
  }

  function exportCsv() {
    if (!summary) return;
    const rows: Array<[string, string | number]> = [
      ['Report', 'GatePass dashboard'],
      ['Generated at UTC', summary.generatedAtUtc],
      ['Window from UTC', summary.window.fromUtc],
      ['Window to UTC', summary.window.toUtc],
      ['Operator filter', operatorId],
      ['Site filter', siteId],
      ['Role view', summary.audience.role],
      ['On site now', summary.totalOnSite],
      ['Pending requests', summary.pendingRequests],
      ['Active approvals', summary.approvedRequests],
      ['Denied requests in window', summary.deniedRequests],
      ...(showAttendanceAnalytics ? [
        ['Movements', summary.movements.total],
        ['Entries', summary.movements.entries],
        ['Exits', summary.movements.exits],
        ['Denied movements', summary.movements.denied],
      ] as Array<[string, string | number]> : []),
      ['Eligible workforce', summary.workforce.eligibleWorkers],
      ['Cleared workforce', summary.workforce.clearedWorkers],
      ['Readiness rate', summary.workforce.readinessRate],
      ['Expired credentials', summary.expiry.expired],
      ['Credentials expiring next 7 days', summary.expiry.next7Days],
      ['Missing worker profiles', summary.dataQuality.missingWorkerProfiles],
      ['Occupancy mismatch sites', summary.dataQuality.occupancyMismatchSites],
      ['Registration cohort', summary.registrationFunnel?.cohortWorkers ?? 'Private'],
      ['Registration profiles completed', summary.registrationFunnel?.profileCompletedWorkers ?? 'Private'],
      ['Registration evidence started', summary.registrationFunnel?.evidenceStartedWorkers ?? 'Private'],
      ['Registration submitted', summary.registrationFunnel?.submittedWorkers ?? 'Private'],
      ['Registration cleared', summary.registrationFunnel?.clearedWorkers ?? 'Private'],
      ['Registration submitted rate', summary.registrationFunnel?.submissionRate ?? 'Private'],
      ['Registration clearance rate', summary.registrationFunnel?.clearanceRate ?? 'Private'],
      ['Registration may need follow-up', summary.registrationFunnel?.stalledBeforeSubmissionWorkers ?? 'Private'],
    ];
    const csv = ['Metric,Value', ...rows.map(([metric, value]) => `${csvCell(metric)},${csvCell(value)}`)].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `gatepass-dashboard-${summary.generatedAtUtc.slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="flex flex-wrap items-center justify-end gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={saveCurrentView} className="inline-flex h-8 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 shadow-sm transition hover:border-primary/30 hover:bg-primary/5 hover:text-primary">
          <Save className="h-4 w-4" />
          Save view
        </button>
        <button type="button" onClick={() => setShowGlossary((value) => !value)} className="inline-flex h-8 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 shadow-sm transition hover:border-primary/30 hover:bg-primary/5 hover:text-primary">
          <BookOpen className="h-4 w-4" />
          Glossary
        </button>
        <button type="button" onClick={exportCsv} disabled={!summary} className="inline-flex h-8 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 shadow-sm transition hover:border-primary/30 hover:bg-primary/5 hover:text-primary disabled:opacity-50">
          <Download className="h-4 w-4" />
          Export CSV
        </button>
        {savedViews.length > 0 ? (
          <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-400">
            Saved view
            <select
              aria-label="Saved dashboard view"
              defaultValue=""
              onChange={(event) => {
                const view = savedViews.find((item) => item.id === event.target.value);
                if (view) onApplyView(view);
              }}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[11px] text-slate-700 shadow-sm"
            >
              <option value="" disabled>Choose…</option>
              {savedViews.map((view) => <option key={view.id} value={view.id}>{view.name}</option>)}
            </select>
          </label>
        ) : null}
      </div>
      {showGlossary ? (
        <dl className="basis-full mt-2 grid gap-3 border-t border-slate-200 pt-4 md:grid-cols-2 xl:grid-cols-3">
          {glossary.filter(([term]) => showAttendanceAnalytics || term !== 'Movements').map(([term, definition]) => (
            <div key={term}>
              <dt className="text-xs font-semibold text-slate-800">{term}</dt>
              <dd className="mt-0.5 text-xs text-slate-500">{definition}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}

function csvCell(value: string | number) {
  const rawValue = String(value);
  const stringValue = /^[=+\-@]/.test(rawValue) ? `'${rawValue}` : rawValue;
  return /[",\r\n]/.test(stringValue) ? `"${stringValue.replaceAll('"', '""')}"` : stringValue;
}

function readSavedViews(): SavedView[] {
  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);
    if (!rawValue) return [];
    const parsedValue: unknown = JSON.parse(rawValue);
    return Array.isArray(parsedValue)
      ? parsedValue.filter(isSavedView).slice(0, 10)
      : [];
  } catch {
    return [];
  }
}

function isSavedView(value: unknown): value is SavedView {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SavedView>;
  return typeof candidate.id === 'string'
    && typeof candidate.name === 'string'
    && typeof candidate.operatorId === 'string'
    && typeof candidate.siteId === 'string'
    && (candidate.reportingWindow === '24h'
      || candidate.reportingWindow === '7d'
      || candidate.reportingWindow === '30d'
      || (candidate.reportingWindow === 'custom'
        && typeof candidate.customFromLocal === 'string'
        && typeof candidate.customToLocal === 'string'));
}
