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

  if (dated.length === 0) {
    return user.role === 'Worker'
      ? { state: 'Missing', detail: 'No identity document on file', daysRemaining: null }
      : { state: 'None', detail: '', daysRemaining: null };
  }

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

export const CREDENTIAL_BADGE: Record<CredentialState, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'warning' | 'success' }> = {
  Expired: { label: 'Expired', variant: 'destructive' },
  Expiring: { label: 'Expiring', variant: 'warning' },
  Valid: { label: 'In order', variant: 'success' },
  Missing: { label: 'No documents', variant: 'destructive' },
  None: { label: '—', variant: 'secondary' },
};
