'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Search } from 'lucide-react';
import { apiRequest, fetchWorkerStandingsRequest, listCertificateTypesRequest, type WorkerStanding } from '@/lib/api';
import { useSession } from '@/providers/session-provider';
import type { ProjectRecord } from '@/components/projects/project-wizard-dialog';
import type { CertificateType } from '@/lib/types';
import { PersonnelDetailsDialog } from '@/components/projects/personnel-details-dialog';
import { WorkerTransferReview, type TransferWorker } from '@/components/projects/worker-transfer-review';
import { getWorkPassStatusPresentation, isWorkerComplianceSatisfied } from '@/components/projects/project-command-center';

type Worker = TransferWorker & { nationalId?: string | null; clearanceStatus?: string | null; email?: string | null; contractorName?: string | null; jobPositionName?: string | null };
type WorkPass = { id: string; projectId: string; projectName: string; siteName: string; passNumber: string; status: string; validFromUtc: string; validToUtc: string; taskDescription?: string | null; submittedByName: string; submittingContractorName?: string | null; approvedByName?: string | null; approvedAtUtc?: string | null; secondApprovedByName?: string | null; workers: Worker[] };

export default function WorkerAccessRequestPage() {
  const params = useParams<{ id: string; workPassId: string }>();
  const { token } = useSession();
  const [request, setRequest] = useState<WorkPass | null>(null);
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [certificateTypes, setCertificateTypes] = useState<CertificateType[]>([]);
  // The server's verdict per worker; null until it has answered.
  const [standings, setStandings] = useState<Record<string, WorkerStanding> | null>(null);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [company, setCompany] = useState('all');
  const [jobRole, setJobRole] = useState('all');
  const [compliance, setCompliance] = useState('all');
  const [error, setError] = useState('');
  const [decisionRevision, setDecisionRevision] = useState(0);

  useEffect(() => {
    if (!token) return;
    apiRequest<WorkPass>(`/work-passes/${params.workPassId}`, { token }).then((data) => {
      setRequest(data);
      // Compliance is the server's call, asked for in one request; a failed request leaves everyone not compliant.
      fetchWorkerStandingsRequest(token, data.workers.map((item) => item.userId))
        .catch(() => [] as WorkerStanding[])
        .then((rows) => setStandings(Object.fromEntries(rows.map((row) => [row.userId, row]))));
    }).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load this request.'));
    apiRequest<ProjectRecord>(`/projects/${params.id}`, { token }).then(setProject).catch(() => {});
    listCertificateTypesRequest(token).then(setCertificateTypes).catch(() => []);
  }, [params.id, params.workPassId, token, decisionRevision]);

  const isWorkerCompliant = (item: Worker) => isWorkerComplianceSatisfied(standings?.[item.userId]);

  const filtered = useMemo(() => (request?.workers ?? []).filter((item) => {
    const query = search.trim().toLowerCase();
    return (!query || [item.name, item.email, item.contractorName, item.jobPositionName].some((value) => value?.toLowerCase().includes(query)))
      && (company === 'all' || item.contractorName === company)
      && (jobRole === 'all' || item.jobPositionName === jobRole)
      && (compliance === 'all' || (compliance === 'compliant') === isWorkerCompliant(item));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [company, compliance, jobRole, standings, request, search]);

  if (error) return <div className="p-6 text-sm text-danger-ink" role="alert">{error}</div>;
  if (!request) return <div className="p-6 text-sm text-muted-foreground">Loading request…</div>;

  const companies = [...new Set(request.workers.map((item) => item.contractorName).filter(Boolean))] as string[];
  const jobRoles = [...new Set(request.workers.map((item) => item.jobPositionName).filter(Boolean))] as string[];
  const statusPresentation = getWorkPassStatusPresentation(request.status);

  return <div className="space-y-5">
    <header><Link href={`/projects/${params.id}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> {request.projectName}</Link><div className="mt-4 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-semibold">{request.passNumber}</h1><span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusPresentation.className}`}>{statusPresentation.label}</span></div><p className="mt-1 text-sm text-muted-foreground">{request.siteName} · {new Date(request.validFromUtc).toLocaleDateString()} – {new Date(request.validToUtc).toLocaleDateString()}</p></header>
    <section className="grid gap-3 md:grid-cols-3"><Info label="Submitting contractor" value={request.submittingContractorName || 'Operator'} /><Info label="Submitted by" value={request.submittedByName || 'Unknown'} /><Info label="Consulted by" value={request.approvedByName || 'Awaiting consultation'} /></section>
    <WorkerTransferReview passId={request.id} status={request.status} projectName={request.projectName} siteName={request.siteName} workers={request.workers} onDecision={() => setDecisionRevision(revision => revision + 1)} />
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border px-5 py-4"><h2 className="font-semibold">Workers</h2><p className="text-sm text-muted-foreground">Select a worker to review the submitted details.</p></div>
      <div className="grid gap-3 border-b border-border px-5 py-4 sm:grid-cols-[minmax(14rem,1fr)_repeat(3,minmax(9rem,auto))]">
        <label className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><input aria-label="Search workers" className="h-9 w-full rounded-md border border-border pl-9 pr-3 text-sm" placeholder="Search workers" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <select aria-label="Company" className="h-9 rounded-md border px-3 text-sm" value={company} onChange={(event) => setCompany(event.target.value)}><option value="all">All companies</option>{companies.map((item) => <option key={item}>{item}</option>)}</select>
        <select aria-label="Job role" className="h-9 rounded-md border px-3 text-sm" value={jobRole} onChange={(event) => setJobRole(event.target.value)}><option value="all">All job roles</option>{jobRoles.map((item) => <option key={item}>{item}</option>)}</select>
        <select aria-label="Compliance" className="h-9 rounded-md border px-3 text-sm" value={compliance} onChange={(event) => setCompliance(event.target.value)}><option value="all">All compliance</option><option value="compliant">Compliant</option><option value="inactive">Non-compliant</option></select>
      </div>
      <div className="max-h-[60vh] overflow-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-muted text-muted-foreground"><tr><th className="px-5 py-3">Name</th><th className="px-5 py-3">Company</th><th className="px-5 py-3">Job role</th><th className="px-5 py-3">National ID</th><th className="px-5 py-3">Compliance</th></tr></thead>
          <tbody className="divide-y divide-border">{filtered.map((item) => {
            const compliant = isWorkerCompliant(item);
            return <tr key={item.userId} className="cursor-pointer hover:bg-muted" onClick={() => setSelectedWorkerId(item.userId)}>
              <td className="px-5 py-4 font-medium">{item.name}{item.assignmentEndedAtUtc ? <p className="mt-1 text-xs font-normal text-muted-foreground">Transferred out {new Date(item.assignmentEndedAtUtc).toLocaleDateString()}</p> : null}</td>
              <td className="px-5 py-4">{item.contractorName || '—'}</td>
              <td className="px-5 py-4">{item.jobPositionName || '—'}</td>
              <td className="px-5 py-4 font-mono">{item.nationalId || '—'}</td>
              <td className="px-5 py-4">{standings === null
                ? <span className="rounded-full bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">Checking…</span>
                : <>
                  <span title={standings[item.userId]?.reasons.join('\n') || undefined} className={`rounded-full px-2 py-1 text-xs font-semibold ${compliant ? 'bg-success-soft text-success-ink' : 'bg-danger-soft text-danger-ink'}`}>{compliant ? 'Compliant' : 'Non-compliant'}</span>
                  {!compliant && standings[item.userId]?.reasons[0]
                    ? <span className="mt-1 block text-xs text-muted-foreground">{standings[item.userId].reasons[0]}{standings[item.userId].reasons.length > 1 ? ` +${standings[item.userId].reasons.length - 1} more` : ''}</span>
                    : null}
                </>}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    </section>
    <PersonnelDetailsDialog
      personId={selectedWorkerId}
      open={Boolean(selectedWorkerId)}
      onOpenChange={(open) => { if (!open) setSelectedWorkerId(null); }}
      operatorId={project?.operatorId}
      certificateTypes={certificateTypes}
    />
  </div>;
}

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-border bg-card p-4"><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="mt-1 font-medium text-foreground">{value}</dd></div>; }
