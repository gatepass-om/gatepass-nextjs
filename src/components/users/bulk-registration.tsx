'use client'

import { useState } from 'react';
import { AlertCircle, CheckCircle2, FileSpreadsheet } from 'lucide-react';
import { bulkRegisterUsersRequest, type BulkRegistrationResult } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { parseBulkRosterCsv } from './bulk-registration-parser';

export function BulkRegistration({
  token,
  onComplete,
}: {
  token: string;
  onComplete: () => void;
}) {
  const [csv, setCsv] = useState('');
  const [preview, setPreview] = useState<BulkRegistrationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rows = parseBulkRosterCsv(csv);

  async function run(dryRun: boolean) {
    if (rows.length === 0) {
      setError('Add at least one roster row below.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await bulkRegisterUsersRequest(token, {
        idempotencyKey: dryRun ? `preview-${Date.now()}` : crypto.randomUUID(),
        dryRun,
        users: rows,
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
    setCsv(await file.text());
    setPreview(null);
    setError(null);
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border bg-muted/30 p-4 text-sm">
        <div className="flex items-center gap-2 font-medium"><FileSpreadsheet className="h-4 w-4" />Import a worker roster</div>
        <p className="mt-1 text-muted-foreground">
          Upload a CSV from Excel, or paste it below. Check the rows before saving; one bad row will not hide the good ones.
        </p>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="roster-file">Choose CSV file</label>
        <Input id="roster-file" type="file" accept=".csv,text/csv" onChange={(event) => void readFile(event.target.files?.[0])} />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="roster-csv">Or paste spreadsheet rows</label>
        <Textarea
          id="roster-csv"
          className="min-h-40 font-mono text-xs"
          value={csv}
          onChange={(event) => {
            setCsv(event.target.value);
            setPreview(null);
          }}
          placeholder={'name,workerCode,preferredLanguage,interactionMode,phoneAvailable\nAsha Devi,W-101,hi,PrintedCard,no'}
        />
        <p className="text-xs text-muted-foreground">{rows.length} data row{rows.length === 1 ? '' : 's'} detected.</p>
      </div>
      {error && <p className="flex items-center gap-2 text-sm text-destructive"><AlertCircle className="h-4 w-4" />{error}</p>}
      {preview && (
        <div className="rounded-lg border p-3 text-sm">
          <p className="flex items-center gap-2 font-medium">
            {preview.invalid === 0 ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-amber-600" />}
            {preview.valid} ready, {preview.invalid} need attention, {preview.created} saved
          </p>
          {preview.results.filter((row) => !row.isValid).map((row) => (
            <p key={row.rowNumber} className="mt-2 text-xs text-destructive">
              Row {row.rowNumber}: {row.errors.join(' ')}
            </p>
          ))}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" disabled={busy || rows.length === 0} onClick={() => void run(true)}>
          {busy ? 'Checking…' : 'Check rows'}
        </Button>
        <Button type="button" disabled={busy || !preview || preview.invalid > 0} onClick={() => void run(false)}>
          Save valid people
        </Button>
      </div>
    </div>
  );
}
