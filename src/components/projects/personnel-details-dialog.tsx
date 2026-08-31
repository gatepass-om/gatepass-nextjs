'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Briefcase, Building2, CheckCircle2, ClipboardCheck, FileWarning, Globe2, Loader2, Mail, ShieldCheck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { WorkerDocuments } from '@/components/workers/worker-documents';
import { WorkerPositionCompliancePanel } from '@/components/compliance/worker-position-compliance';
import { getUserByIdRequest, listProjectsForMemberRequest, type ProjectMembershipSummary } from '@/lib/api';
import { fetchWorkerInspectionHistory, type InspectionRecord } from '@/lib/inspections-api';
import type { CertificateType, User } from '@/lib/types';
import { useSession } from '@/providers/session-provider';

type PersonnelDetailPerson = User & { contractorName?: string | null; operatorName?: string | null };

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
        <p className="truncate text-sm font-medium text-slate-900">{value}</p>
      </div>
    </div>
  );
}

export function PersonnelDetailsDialog({
  personId,
  open,
  onOpenChange,
  operatorId,
  certificateTypes,
}: {
  personId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operatorId?: string;
  certificateTypes: CertificateType[];
}) {
  const { token } = useSession();
  const [person, setPerson] = useState<PersonnelDetailPerson | null>(null);
  const [loadingPerson, setLoadingPerson] = useState(false);
  const [projects, setProjects] = useState<ProjectMembershipSummary[]>([]);
  const [inspections, setInspections] = useState<InspectionRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (!open || !personId || !token) return;
    let active = true;
    setPerson(null);
    setLoadingPerson(true);
    setLoadingHistory(true);
    getUserByIdRequest(token, personId).then((data) => { if (active) setPerson(data); }).finally(() => { if (active) setLoadingPerson(false); });
    Promise.all([
      listProjectsForMemberRequest(token, personId, operatorId).catch(() => []),
      fetchWorkerInspectionHistory(token, personId).catch(() => []),
    ]).then(([projectData, inspectionData]) => {
      if (!active) return;
      setProjects(projectData);
      setInspections(inspectionData);
    }).finally(() => { if (active) setLoadingHistory(false); });
    return () => { active = false; };
  }, [open, personId, token, operatorId]);

  if (!personId) return null;

  const initials = person?.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase() ?? '';
  const company = person?.contractorName || person?.operatorName || person?.company || 'Operator';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(700px,88vh)] flex-col overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b border-slate-200 px-6 py-5">
          {loadingPerson || !person ? (
            <>
              <DialogTitle className="sr-only">Personnel details</DialogTitle>
              <DialogDescription className="sr-only">Loading personnel details.</DialogDescription>
              <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading personnel details…</div>
            </>
          ) : (
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14 border border-slate-200">
                <AvatarImage src={person.avatarUrl ?? undefined} alt={person.name} className="object-cover" />
                <AvatarFallback className="text-lg font-semibold">{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <DialogTitle className="truncate">{person.name}</DialogTitle>
                <DialogDescription className="truncate">
                  {person.role}{person.employment?.jobPositionName ? ` · ${person.employment.jobPositionName}` : ''} · {company}
                </DialogDescription>
              </div>
              {person.status ? (
                <Badge className="ml-auto shrink-0" variant={person.status === 'Active' ? 'secondary' : 'destructive'}>{person.status}</Badge>
              ) : null}
            </div>
          )}
        </DialogHeader>

        <Tabs defaultValue="info" className="flex min-h-0 flex-1 flex-col">
          <TabsList className="mx-6 mt-4 grid shrink-0 grid-cols-4">
            <TabsTrigger value="info">Info</TabsTrigger>
            <TabsTrigger value="certificates">Certificates</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
          </TabsList>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <TabsContent value="info" className="mt-0 grid gap-4 sm:grid-cols-2">
              {loadingPerson || !person ? (
                <div className="col-span-2 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
              ) : (
                <>
                  <InfoRow icon={Mail} label="Email" value={person.email || 'Not provided'} />
                  <InfoRow icon={ShieldCheck} label="National ID" value={person.idNumber || 'Not provided'} />
                  <InfoRow icon={Building2} label="Company" value={company} />
                  <InfoRow icon={Briefcase} label="Job position" value={person.employment?.jobPositionName || 'Not assigned'} />
                  <InfoRow icon={Globe2} label="Nationality" value={person.nationality || 'Not provided'} />
                  {person.clearanceStatus ? <InfoRow icon={CheckCircle2} label="Clearance status" value={person.clearanceStatus} /> : null}
                </>
              )}
            </TabsContent>

            <TabsContent value="certificates" className="mt-0 space-y-4">
              <WorkerPositionCompliancePanel workerId={personId} />
              <div className="rounded-xl border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-900">All certificates on file</h3>
                {loadingPerson || !person ? (
                  <div className="mt-2 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
                ) : person.certificates?.length ? (
                  <ul className="mt-3 divide-y divide-slate-100">
                    {person.certificates.map((cert) => (
                      <li key={cert.certificateTypeId} className="flex items-center justify-between gap-3 py-2 text-sm">
                        <span className="font-medium text-slate-800">{cert.name || 'Certificate'}</span>
                        <span className="text-xs text-slate-500">
                          {cert.expiresAtUtc ? `Expires ${formatDate(cert.expiresAtUtc)}` : 'No expiry'}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">No certificates on file.</p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="history" className="mt-0 space-y-5">
              {loadingHistory ? (
                <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading history…</div>
              ) : (
                <>
                  <section>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Briefcase className="h-4 w-4" /> Projects</h3>
                    {projects.length ? (
                      <ul className="mt-3 space-y-2">
                        {projects.map((project) => (
                          <li key={project.id} className="rounded-xl border border-slate-200 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm font-medium text-slate-900">{project.name}</span>
                              <Badge variant="outline">{project.status}</Badge>
                            </div>
                            <p className="mt-1 text-xs text-slate-500">
                              {project.operatorName} · {formatDate(project.validFromUtc)} – {formatDate(project.validToUtc)}
                            </p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-slate-500">{operatorId ? 'No other projects found for this operator.' : 'No projects found.'}</p>
                    )}
                  </section>

                  <section>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><ClipboardCheck className="h-4 w-4" /> Inspection history</h3>
                    {inspections.length ? (
                      <ul className="mt-3 space-y-2">
                        {inspections.map((inspection) => (
                          <li key={inspection.id} className="rounded-xl border border-slate-200 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm font-medium text-slate-900">{inspection.siteName}</span>
                              <Badge variant={inspection.outcome === 'Compliant' ? 'secondary' : 'destructive'} className="gap-1">
                                {inspection.outcome === 'Compliant' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                                {inspection.outcome === 'Compliant' ? 'Compliant' : 'Non-compliant'}
                              </Badge>
                            </div>
                            <p className="mt-1 text-xs text-slate-500">
                              {formatDate(inspection.inspectedAtUtc)} · Inspected by {inspection.inspectorName}
                            </p>
                            {inspection.wrongfulConductReason ? (
                              <p className="mt-1 flex items-center gap-1.5 text-xs text-red-700"><FileWarning className="h-3.5 w-3.5" /> {inspection.wrongfulConductReason}</p>
                            ) : null}
                            {inspection.notes ? <p className="mt-1 text-xs text-slate-500">{inspection.notes}</p> : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-slate-500">No inspection records.</p>
                    )}
                  </section>
                </>
              )}
            </TabsContent>

            <TabsContent value="documents" className="mt-0">
              <WorkerDocuments workerId={personId} certificateTypes={certificateTypes} canManage={false} />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
