'use client';

import type { ScanCredential } from '@/lib/api';
import { Badge } from '@/components/ui/badge';

const displayDate = (value?: string | null) => value ? new Date(value).toLocaleDateString() : 'Not recorded';

export function WorkerCertificationView({ credentials, checkedAt }: { credentials: ScanCredential[]; checkedAt?: string }) {
  const expired = credentials.filter(item => item.validityStatus === 'Expired').length;
  const missing = credentials.filter(item => item.validityStatus === 'Missing').length;
  const unverified = credentials.filter(item => item.verificationStatus !== 'Verified' && item.validityStatus !== 'Missing').length;
  const problems = [
    expired > 0 ? `${expired} expired` : '',
    missing > 0 ? `${missing} missing` : '',
    unverified > 0 ? `${unverified} awaiting verification` : '',
  ].filter(Boolean);
  return <section aria-labelledby="certification-heading" className="border-t pt-4">
    <div className="flex items-baseline justify-between gap-3">
      <h2 id="certification-heading" className="text-base font-semibold">Training and certificates</h2>
      {checkedAt ? <span className="text-xs text-muted-foreground">Checked {new Date(checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span> : null}
    </div>
    {problems.length > 0 ? <p className="mt-1 text-sm text-danger-ink">{problems.join(' · ')}</p> : null}
    {credentials.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No training or certificate records.</p> : <ul className="mt-2 divide-y">
      {credentials.map(item => <li key={`${item.kind}:${item.id}`} className="py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="break-words text-sm font-medium">{item.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {item.expiresAtUtc ? `Expires ${displayDate(item.expiresAtUtc)}` : 'No expiry'}
              {item.requiredForSite ? ' · Required here' : item.requiredForRole ? ' · Required for job role' : ''}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
            <Badge variant={item.validityStatus === 'Valid' ? 'success' : 'destructive'}>{item.validityStatus}</Badge>
            {item.verificationStatus !== 'Verified' && item.validityStatus !== 'Missing' ? <Badge variant="outline">{item.verificationStatus}</Badge> : null}
          </div>
        </div>
        {item.workRestriction ? <p className="mt-1.5 text-xs"><strong>Work restriction:</strong> {item.workRestriction}</p> : null}
      </li>)}
    </ul>}
  </section>;
}
