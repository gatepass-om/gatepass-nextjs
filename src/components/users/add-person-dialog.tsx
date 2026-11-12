'use client';

import React, { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { buildEmploymentPayload } from '@/components/compliance/compliance-model';
import { NATIONALITY_OPTIONS } from './nationalities';
import type { CreateUserInput } from '@/lib/api';
import type { Contractor, JobPosition, Operator, Site, User, UserRole } from '@/lib/types';

type InlineUserDraft = {
  name: string;
  idNumber: string;
  email: string;
  nationality: string;
  role: UserRole;
  affiliationId: string;
  jobPositionId: string;
  assignedSiteId: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OPERATOR_AFFILIATED_ROLES: UserRole[] = ['Operator Admin', 'Manager', 'Security', 'Inspector'];

export function creatableRoles(role: UserRole): UserRole[] {
  if (role === 'Admin') return ['Operator Admin', 'Contractor Admin', 'Manager', 'Security', 'Worker', 'Supervisor', 'Inspector'];
  if (role === 'Operator Admin') return ['Manager', 'Security', 'Worker', 'Inspector'];
  if (role === 'Contractor Admin') return ['Supervisor', 'Worker'];
  if (role === 'Manager') return ['Security', 'Worker', 'Inspector'];
  if (role === 'Supervisor') return ['Worker'];
  return [];
}

export function validateInlineUserDraft(draft: InlineUserDraft, currentUserRole?: UserRole): string | null {
  if (draft.name.trim().length < 2) return 'Enter the person’s full name.';
  if (!draft.idNumber.trim()) return 'Enter the National ID number.';
  if (!EMAIL_PATTERN.test(draft.email.trim())) return 'Enter a valid email address.';
  if (!draft.nationality) return 'Select a nationality.';
  if (['Worker', 'Supervisor'].includes(draft.role) && !draft.jobPositionId) {
    return 'Select a job position.';
  }
  if (['Security', 'Inspector'].includes(draft.role) && !draft.assignedSiteId) {
    return 'Select an assigned site.';
  }
  if (draft.role === 'Operator Admin' && !draft.affiliationId) return 'Select an operator company.';
  if (draft.role === 'Contractor Admin' && !draft.affiliationId) return 'Select a contractor company.';
  if (currentUserRole === 'Admin' && OPERATOR_AFFILIATED_ROLES.includes(draft.role) && !draft.affiliationId) {
    return 'Select an operator company.';
  }
  return null;
}

const SELECT_CLASS = 'h-10 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-base sm:text-sm';
const STEPS = ['Type', 'Identity', 'Review'] as const;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-medium">{label}{children}</label>;
}

interface AddPersonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: User;
  contractors: Contractor[];
  operators: Operator[];
  sites: Site[];
  jobPositions: JobPosition[];
  onCreateUser: (user: CreateUserInput) => Promise<boolean>;
}

export function AddPersonDialog({ open, onOpenChange, currentUser, contractors, operators, sites, jobPositions, onCreateUser }: AddPersonDialogProps) {
  const roles = useMemo(() => creatableRoles(currentUser.role), [currentUser.role]);
  const blank = (): InlineUserDraft => ({ name: '', idNumber: '', email: '', nationality: '', role: roles[0] ?? 'Worker', affiliationId: '', jobPositionId: '', assignedSiteId: '' });
  const [draft, setDraft] = useState<InlineUserDraft>(blank);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const setField = <K extends keyof InlineUserDraft>(field: K, value: InlineUserDraft[K]) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setError(null);
  };
  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) { setDraft(blank()); setStep(0); setError(null); }
  };

  const companyOptions = OPERATOR_AFFILIATED_ROLES.includes(draft.role) ? operators : contractors;
  const ownCompany = currentUser.role === 'Operator Admin' || currentUser.role === 'Manager'
    ? operators.find((operator) => operator.id === currentUser.operatorId)?.name ?? currentUser.company ?? 'Your operator'
    : currentUser.role === 'Contractor Admin' || currentUser.role === 'Supervisor'
      ? contractors.find((contractor) => contractor.id === currentUser.contractorId)?.name ?? currentUser.company ?? 'Your company'
      : null;
  const needsCompany = !ownCompany && currentUser.role === 'Admin';
  const companyRequired = draft.role !== 'Worker' && draft.role !== 'Supervisor';
  const needsSite = ['Security', 'Inspector'].includes(draft.role);
  const needsPosition = ['Worker', 'Supervisor'].includes(draft.role);
  const companyLabel = ownCompany ?? companyOptions.find((company) => company.id === draft.affiliationId)?.name ?? '—';

  // Each step only checks the fields it shows, so the message always points at something on screen.
  const stepError = (index: number): string | null => {
    if (index === 0) {
      if (needsCompany && companyRequired && !draft.affiliationId) return draft.role === 'Contractor Admin' ? 'Select a contractor company.' : 'Select an operator company.';
      if (needsSite && !draft.assignedSiteId) return 'Select an assigned site.';
      if (needsPosition && !draft.jobPositionId) return 'Select a job position.';
      return null;
    }
    if (index === 1) {
      if (draft.name.trim().length < 2) return 'Enter the person’s full name.';
      if (!draft.idNumber.trim()) return 'Enter the National ID number.';
      if (!EMAIL_PATTERN.test(draft.email.trim())) return 'Enter a valid email address.';
      if (!draft.nationality) return 'Select a nationality.';
    }
    return null;
  };

  const next = () => {
    const problem = stepError(step);
    if (problem) { setError(problem); return; }
    setStep((value) => Math.min(STEPS.length - 1, value + 1));
  };

  const submit = async () => {
    const validationError = validateInlineUserDraft(draft, currentUser.role);
    if (validationError) { setError(validationError); return; }
    const operatorId = currentUser.role === 'Operator Admin' || currentUser.role === 'Manager'
      ? currentUser.operatorId ?? undefined
      : OPERATOR_AFFILIATED_ROLES.includes(draft.role) ? draft.affiliationId : undefined;
    const contractorId = currentUser.role === 'Contractor Admin' || currentUser.role === 'Supervisor'
      ? currentUser.contractorId ?? undefined
      : ['Contractor Admin', 'Worker', 'Supervisor'].includes(draft.role) ? draft.affiliationId || undefined : undefined;

    setSaving(true);
    try {
      const created = await onCreateUser({
        name: draft.name.trim(),
        idNumber: draft.idNumber.trim(),
        email: draft.email.trim(),
        nationality: draft.nationality,
        role: draft.role,
        operatorId,
        contractorId,
        assignedSiteId: draft.assignedSiteId || undefined,
        sendWelcomeEmail: true,
        interactiveAccountEnabled: true,
        registrationChannel: 'SelfService',
        employment: needsPosition
          ? buildEmploymentPayload({ jobPositionId: draft.jobPositionId, operatorId, contractorId })
          : undefined,
      });
      if (created) close(false);
    } finally {
      setSaving(false);
    }
  };

  const positionName = jobPositions.find((position) => position.id === draft.jobPositionId)?.name;
  const siteName = sites.find((site) => site.id === draft.assignedSiteId)?.name;
  const summary: Array<[string, string | undefined]> = [
    ['Name', draft.name.trim()], ['National ID', draft.idNumber.trim()], ['Email', draft.email.trim()], ['Nationality', draft.nationality],
    ['Type', draft.role], ['Company', companyLabel], ['Site', needsSite ? siteName : undefined], ['Job position', needsPosition ? positionName : undefined],
  ];

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add person</DialogTitle>
          <DialogDescription>Step {step + 1} of {STEPS.length} · {STEPS[step]}</DialogDescription>
        </DialogHeader>
        <ol aria-label="Progress" className="grid grid-cols-3 gap-2">
          {STEPS.map((label, index) => <li key={label} aria-current={index === step ? 'step' : undefined} className={`h-1 rounded-full ${index <= step ? 'bg-primary' : 'bg-border'}`}><span className="sr-only">{label}</span></li>)}
        </ol>

        {step === 0 ? (
          <div className="grid gap-4">
            <Field label="Type of person">
              <select aria-label="Type of person" value={draft.role} onChange={(event) => setDraft((current) => ({ ...current, role: event.target.value as UserRole, affiliationId: '', jobPositionId: '', assignedSiteId: '' }))} className={SELECT_CLASS}>
                {roles.map((role) => <option key={role} value={role}>{role}</option>)}
              </select>
            </Field>
            {ownCompany ? (
              <div className="grid gap-1.5 text-sm font-medium">Company<div className="flex h-10 items-center rounded-lg border bg-muted/40 px-3 text-sm font-normal text-muted-foreground">{ownCompany}</div></div>
            ) : needsCompany ? (
              <Field label={companyRequired ? 'Company' : 'Company (optional)'}>
                <select aria-label="Company" value={draft.affiliationId} onChange={(event) => setField('affiliationId', event.target.value)} className={SELECT_CLASS}>
                  <option value="">Select company</option>
                  {companyOptions.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
                </select>
              </Field>
            ) : null}
            {needsSite ? (
              <Field label="Assigned site">
                <select aria-label="Assigned site" value={draft.assignedSiteId} onChange={(event) => setField('assignedSiteId', event.target.value)} className={SELECT_CLASS}>
                  <option value="">Select site</option>
                  {sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
                </select>
              </Field>
            ) : null}
            {needsPosition ? (
              <Field label="Job position">
                <select aria-label="Job position" value={draft.jobPositionId} onChange={(event) => setField('jobPositionId', event.target.value)} className={SELECT_CLASS}>
                  <option value="">Select position</option>
                  {jobPositions.map((position) => <option key={position.id} value={position.id}>{position.name}</option>)}
                </select>
              </Field>
            ) : null}
          </div>
        ) : null}

        {step === 1 ? (
          <div className="grid gap-4">
            <Field label="Full legal name"><Input autoFocus aria-label="Full legal name" value={draft.name} onChange={(event) => setField('name', event.target.value)} /></Field>
            <Field label="National ID number"><Input aria-label="National ID number" inputMode="numeric" value={draft.idNumber} onChange={(event) => setField('idNumber', event.target.value)} /></Field>
            <Field label="Email address"><Input aria-label="Email address" type="email" placeholder="name@company.com" value={draft.email} onChange={(event) => setField('email', event.target.value)} /></Field>
            <Field label="Nationality">
              <select aria-label="Nationality" value={draft.nationality} onChange={(event) => setField('nationality', event.target.value)} className={SELECT_CLASS}>
                <option value="">Select nationality</option>
                {NATIONALITY_OPTIONS.map((nationality) => <option key={nationality} value={nationality}>{nationality}</option>)}
              </select>
            </Field>
          </div>
        ) : null}

        {step === 2 ? (
          <dl className="divide-y rounded-lg border text-sm">
            {summary.filter(([, value]) => value).map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 px-3 py-2"><dt className="text-muted-foreground">{label}</dt><dd className="min-w-0 break-words text-end font-medium">{value}</dd></div>
            ))}
          </dl>
        ) : null}

        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

        <div className="flex items-center justify-between gap-2 border-t pt-4">
          <Button type="button" variant="outline" disabled={saving} onClick={() => (step ? setStep(step - 1) : close(false))}>{step ? 'Back' : 'Cancel'}</Button>
          {step < STEPS.length - 1
            ? <Button type="button" onClick={next}>Continue</Button>
            : <Button type="button" onClick={() => void submit()} disabled={saving}>{saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : 'Create person'}</Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
