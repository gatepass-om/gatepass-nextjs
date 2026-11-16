'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { HeartPulse } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  createPersonDocumentRequest,
  getPersonComplianceRequest,
  listDocumentTypesRequest,
  listMedicalRestrictionCodesRequest,
  reviewWorkerDocument,
  submitPersonDocumentRequest,
  type DocumentTypeInfo,
  type PersonCompliance,
} from '@/lib/api';
import {
  DOCUMENT_CATEGORY_MEDICAL,
  MEDICAL_OUTCOMES,
  canRecordMedical,
  canReviewMedical,
  medicalOutcomeLabel,
  medicalRows,
  restrictionLabel,
  validateMedicalForm,
} from '@/lib/medical';
import { useSession } from '@/providers/session-provider';

const STATE_VARIANT: Record<string, 'success' | 'warning' | 'destructive' | 'secondary'> = {
  Valid: 'success', Verified: 'success', Waived: 'success',
  ExpiringSoon: 'warning', Pending: 'warning', Draft: 'secondary',
  Expired: 'destructive', Rejected: 'destructive', Barred: 'destructive', Missing: 'destructive',
};

/**
 * A worker's medical fitness: the OUTCOME the employer is entitled to (fit, fit with restrictions, unfit, the
 * restrictions, the expiry), never the clinical report, which the system does not store. Whoever may record one
 * does so here; who may decide it does too. The examiner, facility and certificate number are clinical detail and
 * arrive from the server only for people allowed to read them.
 */
export function WorkerMedical({ workerId }: { workerId: string }) {
  const { token, user } = useSession();
  const { toast } = useToast();
  const [compliance, setCompliance] = useState<PersonCompliance | null>(null);
  const [types, setTypes] = useState<DocumentTypeInfo[]>([]);
  const [codes, setCodes] = useState<string[]>([]);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);

  const [typeId, setTypeId] = useState('');
  const [outcome, setOutcome] = useState<number | null>(null);
  const [restrictions, setRestrictions] = useState<string[]>([]);
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [number, setNumber] = useState('');
  const [issuer, setIssuer] = useState('');
  const [examiner, setExaminer] = useState('');
  const [facility, setFacility] = useState('');
  const [attested, setAttested] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);

  const mayRecord = canRecordMedical(user?.role);
  const mayReview = canReviewMedical(user?.role);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [read, allTypes, restrictionCodes] = await Promise.all([
        getPersonComplianceRequest(token, workerId),
        listDocumentTypesRequest(token).catch(() => [] as DocumentTypeInfo[]),
        listMedicalRestrictionCodesRequest(token).catch(() => [] as string[]),
      ]);
      setCompliance(read);
      setTypes(allTypes.filter((type) => type.category === DOCUMENT_CATEGORY_MEDICAL && type.isActive));
      setCodes(restrictionCodes);
      setLoadError('');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Medical fitness could not be loaded.');
    }
  }, [token, workerId]);

  useEffect(() => { void load(); }, [load]);

  const rows = useMemo(() => (compliance ? medicalRows(compliance) : []), [compliance]);
  const pending = useMemo(
    () => (compliance?.otherDocuments ?? []).filter((doc) => doc.category === DOCUMENT_CATEGORY_MEDICAL && doc.reviewStatus === 2),
    [compliance],
  );
  const selectedType = types.find((type) => type.id === typeId);

  const reset = () => {
    setTypeId(''); setOutcome(null); setRestrictions([]); setIssueDate(''); setExpiryDate('');
    setNumber(''); setIssuer(''); setExaminer(''); setFacility(''); setAttested(false); setProblems([]);
  };

  const record = async () => {
    if (!token) return;
    const found = validateMedicalForm({
      typeId, outcome, restrictions, issueDate, expiryDate, number, issuer, attested,
      typeExpires: selectedType?.expires ?? false,
      typeDefaultValidityDays: selectedType?.defaultValidityDays ?? null,
      typeRequiresNumber: selectedType?.requiresNumber ?? false,
      typeRequiresIssuer: selectedType?.requiresIssuer ?? false,
      typeRequiresIssueDate: selectedType?.requiresIssueDate ?? false,
    });
    setProblems(found);
    if (found.length > 0) return;

    setBusy(true);
    try {
      const created = await createPersonDocumentRequest(token, workerId, {
        documentTypeId: typeId,
        number: number.trim() || null,
        issuingAuthority: issuer.trim() || null,
        issueDate: issueDate || null,
        expiryDate: expiryDate || null,
        medicalOutcome: outcome,
        medicalRestrictions: outcome === 2 ? restrictions : [],
        examinerName: examiner.trim() || null,
        examiningFacility: facility.trim() || null,
        attest: true,
      });
      await submitPersonDocumentRequest(token, created.id);
      // The operator side decides; recording does not clear anyone. Anyone who may decide can do it in one step.
      if (mayReview) await reviewWorkerDocument(token, created.id, 'Verified');
      toast({
        title: mayReview ? 'Medical outcome recorded and verified' : 'Medical outcome submitted for review',
        description: mayReview ? undefined : 'It counts once the operator side verifies it.',
      });
      reset();
      await load();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Could not record the medical outcome',
        description: error instanceof Error ? error.message : 'Try again.',
      });
    } finally {
      setBusy(false);
    }
  };

  const decide = async (documentId: string, decision: 'Verified' | 'Rejected') => {
    if (!token) return;
    const note = decision === 'Rejected' ? window.prompt('Why is this being rejected?')?.trim() : undefined;
    if (decision === 'Rejected' && !note) return;
    setBusy(true);
    try {
      await reviewWorkerDocument(token, documentId, decision, note);
      toast({ title: decision === 'Verified' ? 'Medical outcome verified' : 'Medical outcome rejected' });
      await load();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Review failed', description: error instanceof Error ? error.message : 'Try again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><HeartPulse className="h-5 w-5" /> Medical fitness</CardTitle>
        <CardDescription>
          The outcome and its restrictions only. The clinical report is never stored here.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {loadError ? <p role="alert" className="text-sm text-danger-ink">{loadError}</p> : null}

        {rows.length === 0 && !loadError ? (
          <p className="text-sm text-muted-foreground">No medical outcome recorded.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {rows.map((row) => (
              <li key={row.key} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{row.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {medicalOutcomeLabel(row.outcome)}
                    {row.restrictions.length > 0 ? ` · ${row.restrictions.map(restrictionLabel).join(', ')}` : ''}
                    {row.expiryDate ? ` · until ${row.expiryDate}` : ''}
                  </p>
                  {row.blocking === null ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">Recorded. No requirement enforces it, so it does not affect entry.</p>
                  ) : row.blocking ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">Required for entry.</p>
                  ) : (
                    <p className="mt-0.5 text-xs text-muted-foreground">Required, as a warning only.</p>
                  )}
                </div>
                <Badge variant={STATE_VARIANT[row.state] ?? 'secondary'}>{row.state}</Badge>
              </li>
            ))}
          </ul>
        )}

        {mayReview && pending.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Awaiting your decision</p>
            {pending.map((doc) => (
              <div key={doc.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                <span>{doc.typeName} · {medicalOutcomeLabel(doc.medicalOutcome)}</span>
                <span className="flex gap-2">
                  <Button size="sm" disabled={busy} onClick={() => void decide(doc.id, 'Verified')}>Verify</Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => void decide(doc.id, 'Rejected')}>Reject</Button>
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {mayRecord ? (
          <form
            className="space-y-4 rounded-md border bg-muted/30 p-4"
            onSubmit={(event) => { event.preventDefault(); void record(); }}
            aria-label="Record a medical outcome"
          >
            <p className="text-sm font-medium">Record an outcome</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="medical-type">Kind of record</Label>
                <Select value={typeId} onValueChange={setTypeId}>
                  <SelectTrigger id="medical-type" aria-label="Kind of medical record"><SelectValue placeholder="Choose…" /></SelectTrigger>
                  <SelectContent>
                    {types.map((type) => <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="medical-outcome">Outcome</Label>
                <Select
                  value={outcome === null ? '' : String(outcome)}
                  onValueChange={(value) => { const next = Number(value); setOutcome(next); if (next !== 2) setRestrictions([]); }}
                >
                  <SelectTrigger id="medical-outcome" aria-label="Medical outcome"><SelectValue placeholder="Choose…" /></SelectTrigger>
                  <SelectContent>
                    {MEDICAL_OUTCOMES.map((item) => <SelectItem key={item.value} value={String(item.value)}>{item.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {outcome === 2 ? (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Restrictions</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {codes.map((code) => (
                    <label key={code} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={restrictions.includes(code)}
                        onCheckedChange={(checked) => setRestrictions((current) =>
                          checked ? [...current, code] : current.filter((item) => item !== code))}
                      />
                      {restrictionLabel(code)}
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="medical-issue">Issue date</Label>
                <Input id="medical-issue" type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="medical-expiry">Expiry date</Label>
                <Input id="medical-expiry" type="date" value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="medical-number">Certificate number{selectedType?.requiresNumber ? '' : ' (optional)'}</Label>
                <Input id="medical-number" value={number} onChange={(event) => setNumber(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="medical-issuer">Issued by{selectedType?.requiresIssuer ? '' : ' (optional)'}</Label>
                <Input id="medical-issuer" placeholder="Clinic or authority" value={issuer} onChange={(event) => setIssuer(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="medical-examiner">Examiner (optional)</Label>
                <Input id="medical-examiner" value={examiner} onChange={(event) => setExaminer(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="medical-facility">Facility (optional)</Label>
                <Input id="medical-facility" value={facility} onChange={(event) => setFacility(event.target.value)} />
              </div>
            </div>

            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={attested} onCheckedChange={(checked) => setAttested(checked === true)} className="mt-0.5" />
              <span>I have seen the original certificate. Nothing is uploaded, so this is the evidence.</span>
            </label>

            {problems.length > 0 ? (
              <ul role="alert" className="list-disc space-y-0.5 ps-5 text-sm text-danger-ink">
                {problems.map((problem) => <li key={problem}>{problem}</li>)}
              </ul>
            ) : null}

            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : mayReview ? 'Record and verify' : 'Submit for review'}
            </Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
