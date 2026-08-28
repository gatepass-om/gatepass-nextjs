'use client';

import React, { useMemo, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TableCell, TableRow } from '@/components/ui/table';
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

function creatableRoles(role: UserRole): UserRole[] {
  if (role === 'Admin') return ['Operator Admin', 'Contractor Admin'];
  if (role === 'Operator Admin') return ['Manager', 'Security', 'Worker', 'Inspector'];
  if (role === 'Contractor Admin') return ['Supervisor', 'Worker'];
  return [];
}

export function validateInlineUserDraft(draft: InlineUserDraft): string | null {
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
  return null;
}

interface InlineUserRowProps {
  currentUser: User;
  contractors: Contractor[];
  operators: Operator[];
  sites: Site[];
  jobPositions: JobPosition[];
  onCreateUser: (user: CreateUserInput) => Promise<boolean>;
  onCancel: () => void;
}

export function InlineUserRow({
  currentUser,
  contractors,
  operators,
  sites,
  jobPositions,
  onCreateUser,
  onCancel,
}: InlineUserRowProps) {
  const roles = useMemo(() => creatableRoles(currentUser.role), [currentUser.role]);
  const [draft, setDraft] = useState<InlineUserDraft>(() => ({
    name: '',
    idNumber: '',
    email: '',
    nationality: '',
    role: roles[0] ?? 'Worker',
    affiliationId: '',
    jobPositionId: '',
    assignedSiteId: '',
  }));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const setField = <K extends keyof InlineUserDraft>(field: K, value: InlineUserDraft[K]) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setError(null);
  };

  const companyOptions = draft.role === 'Operator Admin' ? operators : contractors;
  const companyName = currentUser.role === 'Operator Admin'
    ? operators.find((operator) => operator.id === currentUser.operatorId)?.name ?? currentUser.company ?? 'Own operator'
    : currentUser.role === 'Contractor Admin'
      ? contractors.find((contractor) => contractor.id === currentUser.contractorId)?.name ?? currentUser.company ?? 'Own contractor'
      : null;

  const submit = async () => {
    const validationError = validateInlineUserDraft(draft);
    if (validationError) {
      setError(validationError);
      return;
    }

    const operatorId = currentUser.role === 'Operator Admin'
      ? currentUser.operatorId ?? undefined
      : draft.role === 'Operator Admin'
        ? draft.affiliationId
        : undefined;
    const contractorId = currentUser.role === 'Contractor Admin'
      ? currentUser.contractorId ?? undefined
      : draft.role === 'Contractor Admin'
        ? draft.affiliationId
        : undefined;

    setSaving(true);
    try {
      const created = await onCreateUser({
        name: draft.name.trim(),
        idNumber: draft.idNumber.trim(),
        email: draft.email.trim(),
        nationality: draft.nationality,
        role: draft.role,
        status: 'Active',
        operatorId,
        contractorId,
        assignedSiteId: draft.assignedSiteId || undefined,
        sendWelcomeEmail: true,
        interactiveAccountEnabled: true,
        registrationChannel: 'SelfService',
        employment: ['Worker', 'Supervisor'].includes(draft.role)
          ? buildEmploymentPayload({ jobPositionId: draft.jobPositionId, operatorId, contractorId })
          : undefined,
      });
      if (created) onCancel();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <TableRow className="bg-muted/25 align-top hover:bg-muted/25">
        <TableCell className="border-r p-1.5">
          <Input autoFocus aria-label="Full legal name" placeholder="Full legal name" value={draft.name} onChange={(event) => setField('name', event.target.value)} className="h-9 min-w-44" />
        </TableCell>
        <TableCell className="border-r p-1.5">
          <Input aria-label="National ID number" placeholder="National ID" value={draft.idNumber} onChange={(event) => setField('idNumber', event.target.value)} className="h-9 min-w-36" />
        </TableCell>
        <TableCell className="border-r p-1.5">
          <Input aria-label="Email address" type="email" placeholder="name@company.com" value={draft.email} onChange={(event) => setField('email', event.target.value)} className="h-9 min-w-52" />
        </TableCell>
        <TableCell className="border-r p-1.5">
          {companyName ? (
            <div className="flex h-9 min-w-40 items-center rounded-md border bg-muted/40 px-3 text-xs text-muted-foreground">{companyName}</div>
          ) : (
            <select aria-label="Company" value={draft.affiliationId} onChange={(event) => setField('affiliationId', event.target.value)} className="h-9 min-w-44 rounded-md border bg-background px-2 text-sm">
              <option value="">Select company</option>
              {companyOptions.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
            </select>
          )}
        </TableCell>
        <TableCell className="border-r p-1.5">
          <select aria-label="Nationality" value={draft.nationality} onChange={(event) => setField('nationality', event.target.value)} className="h-9 min-w-40 rounded-md border bg-background px-2 text-sm">
            <option value="">Select nationality</option>
            {NATIONALITY_OPTIONS.map((nationality) => <option key={nationality} value={nationality}>{nationality}</option>)}
          </select>
        </TableCell>
        <TableCell className="border-r p-1.5">
          {['Worker', 'Supervisor'].includes(draft.role) ? (
            <select aria-label="Job position" value={draft.jobPositionId} onChange={(event) => setField('jobPositionId', event.target.value)} className="h-9 min-w-44 rounded-md border bg-background px-2 text-sm">
              <option value="">Select position</option>
              {jobPositions.map((position) => <option key={position.id} value={position.id}>{position.name}</option>)}
            </select>
          ) : <span className="flex h-9 items-center px-2 text-muted-foreground">—</span>}
        </TableCell>
        <TableCell className="border-r p-1.5">
          <select aria-label="Type of person" value={draft.role} onChange={(event) => setDraft((current) => ({ ...current, role: event.target.value as UserRole, affiliationId: '', jobPositionId: '', assignedSiteId: '' }))} className="h-9 min-w-40 rounded-md border bg-background px-2 text-sm">
            {roles.map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
        </TableCell>
        <TableCell className="border-r p-1.5">
          {['Security', 'Inspector'].includes(draft.role) ? (
            <select aria-label="Assigned site" value={draft.assignedSiteId} onChange={(event) => setField('assignedSiteId', event.target.value)} className="h-9 min-w-40 rounded-md border bg-background px-2 text-sm">
              <option value="">Select site</option>
              {sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
            </select>
          ) : <span className="flex h-9 items-center px-2 text-muted-foreground">—</span>}
        </TableCell>
        <TableCell className="p-1.5">
          <div className="flex justify-end gap-1">
            <Button type="button" size="icon" className="h-9 w-9" aria-label="Save personnel row" onClick={() => void submit()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              <span className="sr-only">{saving ? 'Saving…' : 'Save row'}</span>
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-9 w-9" aria-label="Cancel personnel row" onClick={onCancel} disabled={saving}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
      {error ? (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={9} className="py-2 text-sm text-destructive">{error}</TableCell>
        </TableRow>
      ) : null}
    </>
  );
}
