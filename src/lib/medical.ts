/**
 * Medical fitness, as the document model records it: an OUTCOME, never the clinical report. The numbers below are
 * the server's enum values (the API sends enums as integers), kept in one place so no screen guesses them.
 */
export const DOCUMENT_CATEGORY_MEDICAL = 2;
export const ENFORCEMENT_BLOCKING = 1;
export const ENFORCEMENT_WARNING = 2;
export const SCOPE_TENANT = 1;

export const MEDICAL_OUTCOMES = [
  { value: 1, label: 'Fit' },
  { value: 2, label: 'Fit with restrictions' },
  { value: 3, label: 'Unfit' },
] as const;

export function medicalOutcomeLabel(value?: number | null): string {
  return MEDICAL_OUTCOMES.find((outcome) => outcome.value === value)?.label ?? '—';
}

/** "NoWorkAtHeight" → "No work at height". The codes are fixed by the server; this only makes them readable. */
export function restrictionLabel(code: string): string {
  const spaced = code.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Roles that may record an outcome (the server still checks the person is in scope). */
export function canRecordMedical(role?: string) {
  return ['Admin', 'Operator Admin', 'Manager', 'Contractor Admin', 'Supervisor'].includes(role ?? '');
}

/** Roles that may verify or reject one. A contractor records; the operator side decides. */
export function canReviewMedical(role?: string) {
  return ['Admin', 'Operator Admin', 'Manager'].includes(role ?? '');
}

export type GatingMode = 'off' | 'warning' | 'blocking';

/** Not required (no rule), required as a warning, or required with entry refused. */
export function gatingModeOf(enforcement?: number | null): GatingMode {
  if (enforcement === ENFORCEMENT_BLOCKING) return 'blocking';
  if (enforcement === ENFORCEMENT_WARNING) return 'warning';
  return 'off';
}

/** Only an administrator manages which documents are required. */
export function canConfigureMedicalGating(role?: string) {
  return ['Admin', 'Operator Admin'].includes(role ?? '');
}

export type MedicalFormInput = {
  typeId: string;
  outcome: number | null;
  restrictions: string[];
  issueDate: string;
  expiryDate: string;
  number: string;
  issuer: string;
  attested: boolean;
  /** What the chosen kind of record demands before it can be submitted: the form must collect all of it. */
  typeExpires: boolean;
  typeDefaultValidityDays: number | null;
  typeRequiresNumber: boolean;
  typeRequiresIssuer: boolean;
  typeRequiresIssueDate: boolean;
};

/** What is wrong with the form, in the words a person would say it. Empty means it can be sent. */
export function validateMedicalForm(input: MedicalFormInput): string[] {
  const problems: string[] = [];
  if (!input.typeId) problems.push('Choose the kind of medical record.');
  if (input.outcome === null) problems.push('Choose the outcome: fit, fit with restrictions, or unfit.');
  if (input.outcome === 2 && input.restrictions.length === 0) {
    problems.push('Fit with restrictions needs at least one restriction.');
  }
  if (input.outcome !== 2 && input.restrictions.length > 0) {
    problems.push('Restrictions only apply to a fit-with-restrictions outcome.');
  }
  if (input.typeRequiresNumber && !input.number.trim()) problems.push('This kind of record needs a certificate number.');
  if (input.typeRequiresIssuer && !input.issuer.trim()) problems.push('This kind of record needs the clinic or authority that issued it.');
  if (input.typeRequiresIssueDate && !input.issueDate) problems.push('This kind of record needs an issue date.');
  const hasExpiryOrDerivable = Boolean(input.expiryDate)
    || (Boolean(input.issueDate) && input.typeDefaultValidityDays !== null);
  if (input.typeExpires && !hasExpiryOrDerivable) problems.push('This kind of record needs an expiry date.');
  if (input.issueDate && input.expiryDate && input.expiryDate < input.issueDate) {
    problems.push('The expiry date cannot be before the issue date.');
  }
  if (!input.attested) problems.push('Confirm you have seen the original certificate.');
  return problems;
}

export type MedicalRow = {
  key: string;
  title: string;
  outcome?: number | null;
  restrictions: string[];
  state: string;
  expiryDate?: string | null;
  blocking: boolean | null;
};

type RequirementLike = {
  documentTypeId: string; documentTypeName: string; category: number; enforcement: number; state: string;
  documentId?: string | null; expiryDate?: string | null; medicalOutcome?: number | null; restrictions: string[];
};
type DocumentLike = {
  id: string; typeName: string; category: number; reviewStatus: number; expiryDate?: string | null;
  medicalOutcome?: number | null; restrictions: string[];
};

const REVIEW_STATE: Record<number, string> = { 1: 'Draft', 2: 'Pending', 3: 'Verified', 4: 'Rejected' };

/**
 * Every medical record on a person, from the one compliance read: a required type shows its verdict (and whether
 * it blocks); a recorded document no requirement names still shows, as its review status, with blocking null
 * because nothing enforces it. Both views matter: with gating off a recorded Unfit is visible but changes nothing.
 */
export function medicalRows(compliance: { requirements: RequirementLike[]; otherDocuments: DocumentLike[] }): MedicalRow[] {
  const required = compliance.requirements
    .filter((requirement) => requirement.category === DOCUMENT_CATEGORY_MEDICAL)
    .map<MedicalRow>((requirement) => ({
      key: `req-${requirement.documentTypeId}`,
      title: requirement.documentTypeName,
      outcome: requirement.medicalOutcome,
      restrictions: requirement.restrictions ?? [],
      state: requirement.state,
      expiryDate: requirement.expiryDate,
      blocking: requirement.enforcement === ENFORCEMENT_BLOCKING,
    }));
  const recorded = compliance.otherDocuments
    .filter((document) => document.category === DOCUMENT_CATEGORY_MEDICAL)
    .map<MedicalRow>((document) => ({
      key: `doc-${document.id}`,
      title: document.typeName,
      outcome: document.medicalOutcome,
      restrictions: document.restrictions ?? [],
      state: REVIEW_STATE[document.reviewStatus] ?? 'Unknown',
      expiryDate: document.expiryDate,
      blocking: null,
    }));
  return [...required, ...recorded];
}
