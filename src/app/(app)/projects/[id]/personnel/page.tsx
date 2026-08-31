'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Search } from 'lucide-react';
import { apiRequest, assessWorkerPositionRequest, listCertificateTypesRequest, listUsersRequest } from '@/lib/api';
import { useSession } from '@/providers/session-provider';
import type { ProjectRecord } from '@/components/projects/project-wizard-dialog';
import type { CertificateType } from '@/lib/types';
import { PersonnelDetailsDialog } from '@/components/projects/personnel-details-dialog';

type Personnel = {
  id: string;
  name: string;
  email: string;
  role: string;
  status?: string;
  contractorId?: string | null;
  contractorName?: string | null;
  operatorName?: string | null;
  nationality?: string | null;
  idNumber?: string | null;
  avatarUrl?: string | null;
  clearanceStatus?: string | null;
  certificates?: Array<{ certificateTypeId: string; name?: string | null; expiresAtUtc?: string | null }>;
  employment?: { jobPositionName?: string | null } | null;
};

export default function ProjectPersonnelPage() {
  const params = useParams<{ id: string }>();
  const { token } = useSession();
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [people, setPeople] = useState<Personnel[]>([]);
  const [certificateTypes, setCertificateTypes] = useState<CertificateType[]>([]);
  const [jobRoleCompliance, setJobRoleCompliance] = useState<Record<string, boolean>>({});
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [company, setCompany] = useState('all');
  const [role, setRole] = useState('all');
  const [compliance, setCompliance] = useState('all');

  useEffect(() => {
    if (!token) return;
    Promise.all([
      apiRequest<ProjectRecord>(`/projects/${params.id}`, { token }),
      listUsersRequest(token, { pageSize: 1000 }),
      listCertificateTypesRequest(token).catch(() => []),
    ]).then(([projectData, users, certTypes]) => {
      setProject(projectData);
      setCertificateTypes(certTypes);
      const companyIds = new Set(projectData.contractors.map((item) => item.contractorId).concat(projectData.consultantCompanyId));
      const memberIds = new Set(projectData.members.map((item) => item.userId));
      const scoped = (users as Personnel[]).filter((person) => memberIds.has(person.id) || Boolean(person.contractorId && companyIds.has(person.contractorId)));
      setPeople(scoped);
      // Job-role compliance (the same credential-requirement check that gates project/work-pass
      // approval) is assessed per person; account status is combined with it client-side below.
      // No job position assigned means nothing is required of them yet, so that reads as
      // compliant rather than a false non-compliance flag on every non-worker role.
      Promise.all(scoped.map((person) => assessWorkerPositionRequest(token, person.id).then(
        (assessment) => [person.id, !assessment.jobPositionId || assessment.isCompliant] as const,
        () => [person.id, true] as const,
      ))).then((entries) => setJobRoleCompliance(Object.fromEntries(entries)));
    });
  }, [params.id, token]);

  const isPersonCompliant = (person: Personnel) => person.status === 'Active' && (jobRoleCompliance[person.id] ?? true);

  const filtered = useMemo(() => people.filter((person) => {
    const query = search.trim().toLowerCase();
    return (!query || [person.name, person.email, person.contractorName, person.employment?.jobPositionName].some((value) => value?.toLowerCase().includes(query)))
      && (company === 'all' || person.contractorId === company)
      && (role === 'all' || person.role === role)
      && (compliance === 'all' || (compliance === 'compliant') === isPersonCompliant(person));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [company, compliance, jobRoleCompliance, people, role, search]);

  return <div className="space-y-6 p-4 sm:p-6">
    <header><Link href={`/projects/${params.id}`} className="inline-flex items-center gap-2 text-sm text-slate-500"><ArrowLeft className="h-4 w-4" /> {project?.name || 'Project'}</Link><h1 className="mt-4 text-3xl font-semibold">Project personnel</h1><p className="mt-1 text-sm text-slate-500">Personnel from every contractor and consultant assigned to this project. Click a row for full details.</p></header>
    <div className="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_repeat(3,minmax(10rem,auto))]"><label className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input aria-label="Search personnel" className="h-10 w-full rounded-md border border-slate-300 pl-9 pr-3 text-sm" placeholder="Search personnel" value={search} onChange={(event) => setSearch(event.target.value)} /></label><select aria-label="Company" className="h-10 rounded-md border px-3 text-sm" value={company} onChange={(event) => setCompany(event.target.value)}><option value="all">All companies</option>{project?.contractors.map((item) => <option key={item.contractorId} value={item.contractorId}>{item.contractorName}</option>)}</select><select aria-label="Role" className="h-10 rounded-md border px-3 text-sm" value={role} onChange={(event) => setRole(event.target.value)}><option value="all">All roles</option>{[...new Set(people.map((person) => person.role))].map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Compliance" className="h-10 rounded-md border px-3 text-sm" value={compliance} onChange={(event) => setCompliance(event.target.value)}><option value="all">All compliance</option><option value="compliant">Compliant</option><option value="inactive">Non-compliant</option></select></div>
    <section className="overflow-hidden rounded-2xl border bg-white">
      <div className="max-h-[60vh] overflow-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500"><tr><th className="px-5 py-3">Name</th><th className="px-5 py-3">Company</th><th className="px-5 py-3">Job position</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Compliance</th></tr></thead>
          <tbody className="divide-y">{filtered.map((person) => {
            const compliant = isPersonCompliant(person);
            return <tr key={person.id} onClick={() => setSelectedPersonId(person.id)} className="cursor-pointer transition hover:bg-slate-50">
              <td className="px-5 py-4"><span className="font-medium">{person.name}</span><span className="block text-xs text-slate-500">{person.email}</span></td>
              <td className="px-5 py-4">{person.contractorName || 'Operator'}</td>
              <td className="px-5 py-4">{person.employment?.jobPositionName || '—'}</td>
              <td className="px-5 py-4">{person.role}</td>
              <td className="px-5 py-4"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${compliant ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{compliant ? 'Compliant' : 'Non-compliant'}</span></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    </section>
    <PersonnelDetailsDialog
      personId={selectedPersonId}
      open={Boolean(selectedPersonId)}
      onOpenChange={(open) => { if (!open) setSelectedPersonId(null); }}
      operatorId={project?.operatorId}
      certificateTypes={certificateTypes}
    />
  </div>;
}
