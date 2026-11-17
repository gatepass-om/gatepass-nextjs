'use client';

import { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Upload } from 'lucide-react';
import { bulkRegisterUsersRequest, type BulkRegistrationResult } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { inspectBulkRosterCsv } from './bulk-registration-parser';

const rosterTemplate = [
  'Name,National ID,Email,Nationality,Role,Employee Number,Employer',
  'Aisha Al Balushi,12345678,aisha@example.com,Omani,Worker,EMP-001,Example Contractor',
].join('\n');

export function BulkRegistration({ token, onComplete }: { token: string; onComplete: () => void }) {
  const [csv, setCsv] = useState('');
  const [preview, setPreview] = useState<BulkRegistrationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const roster = useMemo(() => inspectBulkRosterCsv(csv), [csv]);

  const updateCsv = (value: string) => {
    setCsv(value);
    setPreview(null);
    setError(null);
  };

  async function run(dryRun: boolean) {
    if (roster.sourceRowCount === 0) {
      setError('Upload a CSV file or paste at least one roster row.');
      return;
    }
    if (roster.errors.length > 0) {
      setError('Fix the highlighted roster rows before checking or importing.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const result = await bulkRegisterUsersRequest(token, {
        idempotencyKey: dryRun ? `preview-${Date.now()}` : crypto.randomUUID(),
        dryRun,
        users: roster.rows,
      });
      setPreview(result);
      if (!dryRun && result.created > 0) onComplete();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The roster could not be checked.');
    } finally {
      setBusy(false);
    }
  }

  async function readFile(file?: File) {
    if (!file) return;
    updateCsv(await file.text());
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([rosterTemplate], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'gatepass-worker-roster-template.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 font-medium"><FileSpreadsheet className="h-4 w-4" /> Import worker roster</p>
            <p className="mt-1 text-sm text-muted-foreground">Upload a CSV exported from Excel, validate it row by row, then import only when the preview is clear.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}><Download className="mr-2 h-4 w-4" />Template</Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Required columns: Name, National ID, Email. Optional: Nationality, Role, Employee Number, Employer.</p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="roster-file">CSV roster</label>
        <Input id="roster-file" type="file" accept=".csv,text/csv" onChange={(event) => void readFile(event.target.files?.[0])} />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="roster-csv">Or paste spreadsheet rows</label>
        <Textarea id="roster-csv" className="min-h-40 font-mono text-xs" value={csv} onChange={(event) => updateCsv(event.target.value)} placeholder={rosterTemplate} />
      </div>

      {csv ? <div className="grid gap-3 rounded-lg border p-3 text-sm sm:grid-cols-3">
        <div><p className="text-muted-foreground">Rows found</p><p className="font-semibold">{roster.sourceRowCount}</p></div>
        <div><p className="text-muted-foreground">Ready to import</p><p className="font-semibold text-emerald-700">{roster.rows.length}</p></div>
        <div><p className="text-muted-foreground">Needs attention</p><p className="font-semibold text-destructive">{roster.errors.length}</p></div>
      </div> : null}

      {roster.errors.length > 0 ? <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
        <p className="flex items-center gap-2 font-medium text-destructive"><AlertCircle className="h-4 w-4" /> Fix these rows before importing</p>
        <ul className="mt-2 space-y-1 text-muted-foreground">
          {roster.errors.slice(0, 8).map((issue) => <li key={`${issue.row}-${issue.message}`}>Row {issue.row}: {issue.message}</li>)}
          {roster.errors.length > 8 ? <li>…and {roster.errors.length - 8} more rows.</li> : null}
        </ul>
      </div> : null}

      {error ? <p className="flex items-center gap-2 text-sm text-destructive"><AlertCircle className="h-4 w-4" />{error}</p> : null}
      {preview ? <div className="rounded-lg border p-3 text-sm">
        <p className="flex items-center gap-2 font-medium">{preview.invalid === 0 ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-destructive" />} Preview result</p>
        <p className="mt-1 text-muted-foreground">{preview.created} ready to create · {preview.invalid} rejected by server validation.</p>
      </div> : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={busy || roster.rows.length === 0 || roster.errors.length > 0} onClick={() => void run(true)}>Check roster</Button>
        <Button type="button" disabled={busy || roster.rows.length === 0 || roster.errors.length > 0} onClick={() => void run(false)}><Upload className="mr-2 h-4 w-4" />Import {roster.rows.length || ''} workers</Button>
      </div>
    </div>
  );
}
