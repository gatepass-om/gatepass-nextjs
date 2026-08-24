'use client';

import { useEffect, useState } from 'react';
import { BookOpen, Download, Save } from 'lucide-react';
import { getDashboardExportRows } from '@/components/dashboard/dashboard-export';
import {
  parseDashboardSavedViews,
  type DashboardSavedView,
  type DashboardRequestStatusFilter,
  type ReportingWindow,
} from '@/components/dashboard/dashboard-saved-views';
import type { DashboardSummary } from '@/lib/api';

export type {
  DashboardRequestStatusFilter,
  ReportingWindow,
} from '@/components/dashboard/dashboard-saved-views';

type Props = {
  summary: DashboardSummary | null;
  showAttendanceAnalytics: boolean;
  operatorId: string;
  siteId: string;
  externalCompanyId: string;
  externalCompanyName?: string;
  accessRequestStatus: DashboardRequestStatusFilter;
  reportingWindow: ReportingWindow;
  customFromLocal: string;
  customToLocal: string;
  onApplyView: (view: Omit<DashboardSavedView, 'id' | 'name'>) => void;
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
  externalCompanyId,
  externalCompanyName,
  accessRequestStatus,
  reportingWindow,
  customFromLocal,
  customToLocal,
  onApplyView,
}: Props) {
  const [savedViews, setSavedViews] = useState<DashboardSavedView[]>([]);
  const [showGlossary, setShowGlossary] = useState(false);

  useEffect(() => {
    setSavedViews(readSavedViews());
  }, []);

  function saveCurrentView() {
    const view: DashboardSavedView = {
      id: crypto.randomUUID(),
      name: `${reportingWindow === 'custom' ? 'Custom range' : reportingWindow} · ${siteId === 'all' ? 'All sites' : 'Selected site'}`,
      operatorId,
      siteId,
      externalCompanyId,
      accessRequestStatus,
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
    const rows = getDashboardExportRows(summary, showAttendanceAnalytics, {
      operatorId,
      siteId,
      externalCompanyId,
      externalCompanyName,
      accessRequestStatus,
    });
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

function readSavedViews(): DashboardSavedView[] {
  try {
    return parseDashboardSavedViews(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}
