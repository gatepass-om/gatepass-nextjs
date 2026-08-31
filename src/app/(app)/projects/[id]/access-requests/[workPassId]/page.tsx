'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Search } from 'lucide-react';
import { apiRequest, assessWorkerPositionRequest, listCertificateTypesRequest } from '@/lib/api';
import { useSession } from '@/providers/session-provider';
import type { ProjectRecord } from '@/components/projects/project-wizard-dialog';
import type { CertificateType } from '@/lib/types';
import { PersonnelDetailsDialog } from '@/components/projects/personnel-details-dialog';

type Worker = { userId: string; name: string; workerCode?: string | null; email?: string | null; contractorName?: string | null; jobPositionName?: string | null };
type WorkPass = { id: string; projectId: string; projectName: string; siteName: string; passNumber: string; status: string; validFromUtc: string; validToUtc: string; taskDescription?: string | null; submittedByName: string; submittingContractorName?: string | null; approvedByName?: string | null; approvedAtUtc?: string | null; secondApprovedByName?: string | null; workers: Worker[] };

export default function WorkerAccessRequestPage() {
  const params = useParams<{ id: string; workPassId: string }>();
  const { token } = useSession();
  const [request, setRequest] = useState<WorkPass | null>(null);
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [certificateTypes, setCertificateTypes] = useState<CertificateType[]>([]);
  const [jobRoleCompliance, setJobRoleCompliance] = useState<Record<string, boolean>>({});
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [company, setCompany] = useState('all');
  const [jobRole, setJobRole] = useState('all');
  const [compliance, setCompliance] = useState('all');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    apiRequest<WorkPass>(`/work-passes/${params.workPassId}`, { token }).then((data) => {
      setRequest(data);
      Promise.all(data.workers.map((item) => assessWorkerPositionRequest(token, item.userId).then(
        (assessment) => [item.userId, !assessment.jobPositionId || assessment.isCompliant] as const,
        () => [item.userId, true] as const,
      ))).then((entries) => setJobRoleCompliance(Object.fromEntries(entries)));
    }).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load this request.'));
    apiRequest<ProjectRecord>(`/projects/${params.id}`, { token }).then(setProject).catch(() => {});
    listCertificateTypesRequest(token).then(setCertificateTypes).catch(() => []);
  }, [params.id, params.workPassId, token]);

  const isWorkerCompliant = (item: Worker) => jobRoleCompliance[item.userId] ?? true;

  const filtered = useMemo(() => (request?.workers ?? []).filter((item) => {
    const query = search.trim().toLowerCase();
    return (!query || [item.name, item.email, item.contractorName, item.jobPositionName].some((value) => value?.toLowerCase().includes(query)))
      && (company === 'all' || item.contractorName === company)
      && (jobRole === 'all' || item.jobPositionName === jobRole)
      && (compliance === 'all' || (compliance === 'compliant') === isWorkerCompliant(item));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [company, compliance, jobRole, jobRoleCompliance, request, search]);

  if (error) return <div className="p-6 text-sm text-red-700" role="alert">{error}</div>;
  if (!request) return <div className="p-6 text-sm text-slate-500">Loading request…</div>;

  const companies = [...new Set(request.workers.map((item) => item.contractorName).filter(Boolean))] as string[];
  const jobRoles = [...new Set(request.workers.map((item) => item.jobPositionName).filter(Boolean))] as string[];

  return <div className="space-y-6 p-4 sm:p-6">
    <header><Link href={`/projects/${params.id}`} className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-950"><ArrowLeft className="h-4 w-4" /> {request.projectName}</Link><div className="mt-4 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-semibold">{request.passNumber}</h1><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">{request.status}</span></div><p className="mt-1 text-sm text-slate-500">{request.siteName} · {new Date(request.validFromUtc).toLocaleDateString()} – {new Date(request.validToUtc).toLocaleDateString()}</p></header>
    <section className="grid gap-3 md:grid-cols-3"><Info label="Submitting contractor" value={request.submittingContractorName || 'Operator'} /><Info label="Submitted by" value={request.submittedByName || 'Unknown'} /><Info label="Consulted by" value={request.approvedByName || 'Awaiting consultation'} /></section>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold">Workers</h2><p className="text-sm text-slate-500">Select a worker to review the submitted details.</p></div>
      <div className="grid gap-3 border-b border-slate-200 px-5 py-4 sm:grid-cols-[minmax(14rem,1fr)_repeat(3,minmax(9rem,auto))]">
        <label className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input aria-label="Search workers" className="h-9 w-full rounded-md border border-slate-300 pl-9 pr-3 text-sm" placeholder="Search workers" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <select aria-label="Company" className="h-9 rounded-md border px-3 text-sm" value={company} onChange={(event) => setCompany(event.target.value)}><option value="all">All companies</option>{companies.map((item) => <option key={item}>{item}</option>)}</select>
        <select aria-label="Job role" className="h-9 rounded-md border px-3 text-sm" value={jobRole} onChange={(event) => setJobRole(event.target.value)}><option value="all">All job roles</option>{jobRoles.map((item) => <option key={item}>{item}</option>)}</select>
        <select aria-label="Compliance" className="h-9 rounded-md border px-3 text-sm" value={compliance} onChange={(event) => setCompliance(event.target.value)}><option value="all">All compliance</option><option value="compliant">Compliant</option><option value="inactive">Non-compliant</option></select>
      </div>
      <div className="max-h-[60vh] overflow-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500"><tr><th className="px-5 py-3">Name</th><th className="px-5 py-3">Company</th><th className="px-5 py-3">Job role</th><th className="px-5 py-3">Worker code</th><th className="px-5 py-3">Compliance</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{filtered.map((item) => {
            const compliant = isWorkerCompliant(item);
            return <tr key={item.userId} className="cursor-pointer hover:bg-slate-50" onClick={() => setSelectedWorkerId(item.userId)}>
              <td className="px-5 py-4 font-medium">{item.name}</td>
              <td className="px-5 py-4">{item.contractorName || '—'}</td>
              <td className="px-5 py-4">{item.jobPositionName || '—'}</td>
              <td className="px-5 py-4">{item.workerCode || '—'}</td>
              <td className="px-5 py-4"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${compliant ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{compliant ? 'Compliant' : 'Non-compliant'}</span></td>
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

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-slate-200 bg-white p-4"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt><dd className="mt-1 font-medium text-slate-950">{value}</dd></div>; }
