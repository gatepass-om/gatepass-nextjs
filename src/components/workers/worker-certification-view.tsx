'use client';

import type { ScanCredential } from '@/lib/api';
import { Badge } from '@/components/ui/badge';

const displayDate = (value?: string | null) => value ? new Date(value).toLocaleDateString() : 'Not recorded';

export function WorkerCertificationView({ credentials, checkedAt }: { credentials: ScanCredential[]; checkedAt?: string }) {
  const expired = credentials.filter(item => item.validityStatus === 'Expired').length;
  const missing = credentials.filter(item => item.validityStatus === 'Missing').length;
  const unverified = credentials.filter(item => item.verificationStatus !== 'Verified' && item.validityStatus !== 'Missing').length;
  return <section aria-labelledby="certification-heading" className="space-y-4 border-t pt-5">
    <div>
      <h2 id="certification-heading" className="text-lg font-semibold">Training and certificates</h2>
      <p className="mt-1 text-sm text-muted-foreground">{credentials.length} records · {expired} expired · {missing} missing · {unverified} awaiting verification</p>
      {checkedAt ? <p className="mt-1 text-xs text-muted-foreground">Checked {new Date(checkedAt).toLocaleString()}. Resolve the QR again to refresh.</p> : null}
    </div>
    {credentials.length === 0 ? <p className="py-4 text-sm text-muted-foreground">No training or certificate records have been submitted.</p> : <ul className="divide-y">
      {credentials.map(item => <li key={`${item.kind}:${item.id}`} className="space-y-3 py-4 first:pt-0">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0"><h3 className="break-words font-medium">{item.name}</h3><p className="mt-1 text-xs text-muted-foreground">{item.kind}{item.requiredForSite ? ' · Required at this site' : ''}{item.requiredForRole ? ' · Required for job role' : ''}</p></div>
          <div className="flex flex-wrap gap-2"><Badge variant={item.validityStatus === 'Valid' ? 'secondary' : 'destructive'}>{item.validityStatus}</Badge><Badge variant="outline">{item.verificationStatus}</Badge></div>
        </div>
        <dl className="grid grid-cols-2 gap-4 text-sm"><div><dt className="text-muted-foreground">Issued</dt><dd className="mt-1 tabular-nums">{displayDate(item.issuedAtUtc)}</dd></div><div><dt className="text-muted-foreground">Expires</dt><dd className="mt-1 tabular-nums">{displayDate(item.expiresAtUtc)}</dd></div></dl>
        {item.workRestriction ? <p className="text-sm"><strong>Work restriction:</strong> {item.workRestriction}</p> : null}
      </li>)}
    </ul>}
  </section>;
}
