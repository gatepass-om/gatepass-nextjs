import type { User } from '@/lib/types';

/**
 * What the personnel register says about one person's paperwork, derived the same way the rest of the
 * system derives it: never stored, always computed from the dates the API returns. The register only
 * has the identity expiry and the certificate expiries, so this is a summary — the worker's own profile
 * and the gate remain the authority. It exists so a row can say *whose* card is expiring and *when*,
 * instead of a count on a dashboard that leads to an unfiltered list.
 */
export type CredentialState = 'Expired' | 'Expiring' | 'Valid' | 'Missing' | 'None';

export type PersonnelStatus = {
  state: CredentialState;
  /** Plain words for the row: "Civil ID expired 3 days ago", "HSE Induction expires in 5 days". */
  detail: string;
  /** Negative when already past. Null when nothing has a date. */
  daysRemaining: number | null;
};

const DAY_MS = 86_400_000;

/** Whole days from `today` to `date`, counting a card as good through its last day. */
export function daysUntil(date: string, today: Date): number {
  const end = new Date(date);
  const a = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  const b = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((a - b) / DAY_MS);
}

function phrase(label: string, days: number): string {
  if (days < 0) return `${label} expired ${Math.abs(days)} ${Math.abs(days) === 1 ? 'day' : 'days'} ago`;
  if (days === 0) return `${label} expires today`;
  return `${label} expires in ${days} ${days === 1 ? 'day' : 'days'}`;
}

/**
 * The worst thing the person holds wins: an expired document outranks one that is merely close, which
 * outranks everything being in order. A worker with no identity expiry and no certificates reads
 * `Missing`, because the gate will refuse them; anyone who is not a worker reads `None` and shows a dash.
 */
export function personnelStatus(user: User, today: Date, expiringWithinDays = 30): PersonnelStatus {
  const dated: Array<{ label: string; days: number }> = [];
  if (user.idExpiresAtUtc) dated.push({ label: 'Identity document', days: daysUntil(user.idExpiresAtUtc, today) });
  for (const certificate of user.certificates ?? []) {
    if (certificate.expiresAtUtc) {
      dated.push({ label: certificate.name || 'Certificate', days: daysUntil(certificate.expiresAtUtc, today) });
    }
  }

  // A worker with no verified identity document is refused at the gate however good their certificates
  // are, so the register must not call them "in order" on the strength of a training card. Identity
  // missing outranks everything else a worker holds.
  if (user.role === 'Worker' && !user.idExpiresAtUtc) {
    return { state: 'Missing', detail: 'No identity document on file', daysRemaining: null };
  }

  if (dated.length === 0) return { state: 'None', detail: '', daysRemaining: null };

  const worst = dated.reduce((lowest, row) => (row.days < lowest.days ? row : lowest));
  const state: CredentialState = worst.days < 0 ? 'Expired' : worst.days <= expiringWithinDays ? 'Expiring' : 'Valid';
  return { state, detail: phrase(worst.label, worst.days), daysRemaining: worst.days };
}

/** Does this person match the filter a Today-page link asked for? */
export function matchesCredentialFilter(
  status: PersonnelStatus,
  filter: string | null,
  withinDays: number | null,
): boolean {
  if (!filter) return true;
  if (filter === 'Expired') return status.state === 'Expired';
  if (filter === 'Expiring') {
    if (status.state !== 'Expiring') return false;
    return withinDays === null || (status.daysRemaining !== null && status.daysRemaining <= withinDays);
  }
  if (filter === 'Missing') return status.state === 'Missing';
  if (filter === 'Valid') return status.state === 'Valid';
  return true;
}

/**
 * Today's action queue sends the register a handful of different filters, each one a different column
 * of the dashboard. They were all being ignored, so every figure on Today opened the same unfiltered
 * list. This maps each one to what the register can actually narrow by, and says plainly when it
 * cannot — a page that admits it cannot narrow is better than one that silently shows everybody.
 *
 * `documentStatus` and `cardStatus` are the two it cannot serve: whether a person has a document
 * awaiting review, or a card waiting to be printed, is not in the personnel list the page loads.
 */
export type PersonnelUrlFilter =
  | { kind: 'none' }
  | { kind: 'credential'; value: CredentialState; withinDays: number | null }
  | { kind: 'clearance'; value: string }
  | { kind: 'identity' }
  | { kind: 'competency'; withinDays: number }
  | { kind: 'unsupported'; what: string };

const CREDENTIAL_VALUES: CredentialState[] = ['Expired', 'Expiring', 'Missing', 'Valid'];

export function personnelUrlFilter(get: (key: string) => string | null): PersonnelUrlFilter {
  const within = (fallback: number | null) => {
    const raw = Number(get('within'));
    return Number.isFinite(raw) && raw > 0 ? raw : fallback;
  };

  const credential = get('credentialStatus');
  if (credential && (CREDENTIAL_VALUES as string[]).includes(credential)) {
    return { kind: 'credential', value: credential as CredentialState, withinDays: within(null) };
  }
  const clearance = get('clearanceStatus');
  if (clearance) return { kind: 'clearance', value: clearance };
  if (get('identityStatus') === 'Unverified') return { kind: 'identity' };
  if (get('competencyStatus') === 'Expiring') return { kind: 'competency', withinDays: within(30) ?? 30 };
  if (get('documentStatus')) return { kind: 'unsupported', what: 'documents awaiting review' };
  if (get('cardStatus')) return { kind: 'unsupported', what: 'cards awaiting print' };
  return { kind: 'none' };
}

/** Does this person belong in the list the Today figure promised? */
export function matchesUrlFilter(
  user: Pick<User, 'clearanceStatus' | 'idExpiresAtUtc' | 'certificates'>,
  status: PersonnelStatus,
  filter: PersonnelUrlFilter,
  today: Date,
): boolean {
  switch (filter.kind) {
    case 'credential':
      return matchesCredentialFilter(status, filter.value, filter.withinDays);
    case 'clearance':
      return (user.clearanceStatus ?? '') === filter.value;
    // The identity expiry column is only written from a *verified* identity document, so its absence is
    // exactly "no identity check has passed yet" — which is what the dashboard counted.
    case 'identity':
      return !user.idExpiresAtUtc;
    case 'competency': {
      const days = (user.certificates ?? [])
        .filter((certificate) => certificate.expiresAtUtc)
        .map((certificate) => daysUntil(certificate.expiresAtUtc as string, today));
      return days.some((value) => value >= 0 && value <= filter.withinDays);
    }
    default:
      return true;
  }
}

export function describeUrlFilter(filter: PersonnelUrlFilter): string | null {
  switch (filter.kind) {
    case 'credential':
      if (filter.value === 'Expired') return 'with an expired document';
      if (filter.value === 'Missing') return 'with no documents on file';
      if (filter.value === 'Valid') return 'whose documents are in order';
      return filter.withinDays
        ? `with a document expiring within ${filter.withinDays} days`
        : 'with a document expiring soon';
    case 'clearance':
      return `whose clearance is ${filter.value.toLowerCase()}`;
    case 'identity':
      return 'whose identity document has not been verified';
    case 'competency':
      return `with a competency expiring within ${filter.withinDays} days`;
    default:
      return null;
  }
}

export const CREDENTIAL_BADGE: Record<CredentialState, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'warning' | 'success' }> = {
  Expired: { label: 'Expired', variant: 'destructive' },
  Expiring: { label: 'Expiring', variant: 'warning' },
  Valid: { label: 'In order', variant: 'success' },
  Missing: { label: 'No documents', variant: 'destructive' },
  None: { label: '—', variant: 'secondary' },
};
