'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { useSession } from '@/providers/session-provider';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Worker = { userId: string; name: string; workerCode?: string | null; email?: string | null; contractorName?: string | null; jobPositionName?: string | null };
type WorkPass = { id: string; projectId: string; projectName: string; siteName: string; passNumber: string; status: string; validFromUtc: string; validToUtc: string; taskDescription?: string | null; submittedByName: string; submittingContractorName?: string | null; approvedByName?: string | null; approvedAtUtc?: string | null; secondApprovedByName?: string | null; workers: Worker[] };

export default function WorkerAccessRequestPage() {
  const params = useParams<{ id: string; workPassId: string }>();
  const { token } = useSession();
  const [request, setRequest] = useState<WorkPass | null>(null);
  const [worker, setWorker] = useState<Worker | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    apiRequest<WorkPass>(`/work-passes/${params.workPassId}`, { token }).then(setRequest).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load this request.'));
  }, [params.workPassId, token]);

  if (error) return <div className="p-6 text-sm text-red-700" role="alert">{error}</div>;
  if (!request) return <div className="p-6 text-sm text-slate-500">Loading request…</div>;

  return <div className="space-y-6 p-4 sm:p-6">
    <header><Link href={`/projects/${params.id}`} className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-950"><ArrowLeft className="h-4 w-4" /> {request.projectName}</Link><div className="mt-4 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-semibold">{request.passNumber}</h1><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">{request.status}</span></div><p className="mt-1 text-sm text-slate-500">{request.siteName} · {new Date(request.validFromUtc).toLocaleDateString()} – {new Date(request.validToUtc).toLocaleDateString()}</p></header>
    <section className="grid gap-3 md:grid-cols-3"><Info label="Submitting contractor" value={request.submittingContractorName || 'Operator'} /><Info label="Submitted by" value={request.submittedByName || 'Unknown'} /><Info label="Consulted by" value={request.approvedByName || 'Awaiting consultation'} /></section>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold">Workers</h2><p className="text-sm text-slate-500">Select a worker to review the submitted details.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-5 py-3">Name</th><th className="px-5 py-3">Company</th><th className="px-5 py-3">Job role</th><th className="px-5 py-3">Worker code</th></tr></thead><tbody className="divide-y divide-slate-100">{request.workers.map((item) => <tr key={item.userId} className="cursor-pointer hover:bg-slate-50" onClick={() => setWorker(item)}><td className="px-5 py-4 font-medium">{item.name}</td><td className="px-5 py-4">{item.contractorName || '—'}</td><td className="px-5 py-4">{item.jobPositionName || '—'}</td><td className="px-5 py-4">{item.workerCode || '—'}</td></tr>)}</tbody></table></div></section>
    <Dialog open={Boolean(worker)} onOpenChange={(open) => !open && setWorker(null)}><DialogContent><DialogHeader><DialogTitle>{worker?.name}</DialogTitle><DialogDescription>Worker details submitted with this access request.</DialogDescription></DialogHeader><dl className="grid gap-4 sm:grid-cols-2"><Info label="Email" value={worker?.email || '—'} /><Info label="Contractor" value={worker?.contractorName || '—'} /><Info label="Job role" value={worker?.jobPositionName || '—'} /><Info label="Worker code" value={worker?.workerCode || '—'} /></dl></DialogContent></Dialog>
  </div>;
}

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-slate-200 bg-white p-4"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt><dd className="mt-1 font-medium text-slate-950">{value}</dd></div>; }
