'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BadgeCheck, BriefcaseBusiness, Loader2, Pencil, Plus, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuthProtection } from '@/hooks/use-auth-protection';
import { useToast } from '@/hooks/use-toast';
import {
  createJobPositionRequest,
  createProjectRoleRequest,
  listCertificateTypesRequest,
  listJobPositionsRequest,
  listProjectRolesRequest,
  updateJobPositionRequest,
  updateProjectRoleRequest,
} from '@/lib/api';
import type { CertificateType, JobPosition, ProjectRole } from '@/lib/types';
import { useSession } from '@/providers/session-provider';
import { KNOWN_WORKFLOW_DUTIES, normalizeDutyKeys } from '@/components/compliance/compliance-model';

type RequirementDraft = { certificateTypeId: string; minimumValidityDays: number };

export default function CompliancePage() {
  const { currentUser, loading: authLoading, isAuthorized, UnauthorizedComponent } = useAuthProtection(['Admin', 'Operator Admin']);
  const { token } = useSession();
  const { toast } = useToast();
  const [positions, setPositions] = useState<JobPosition[]>([]);
  const [roles, setRoles] = useState<ProjectRole[]>([]);
  const [certificateTypes, setCertificateTypes] = useState<CertificateType[]>([]);
  const [loading, setLoading] = useState(true);
  const [positionEditor, setPositionEditor] = useState<JobPosition | 'new' | null>(null);
  const [roleEditor, setRoleEditor] = useState<ProjectRole | 'new' | null>(null);

  const loadData = useCallback(async () => {
    if (!token || !currentUser) return;
    setLoading(true);
    try {
      const [positionData, roleData, certificateData] = await Promise.all([
        listJobPositionsRequest(token),
        listProjectRolesRequest(token),
        listCertificateTypesRequest(token),
      ]);
      setPositions(positionData.sort((a, b) => a.name.localeCompare(b.name)));
      setRoles(roleData.sort((a, b) => a.name.localeCompare(b.name)));
      setCertificateTypes((certificateData as CertificateType[]).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      toast({ variant: 'destructive', title: 'Could not load compliance setup', description: error instanceof Error ? error.message : 'Try again.' });
    } finally {
      setLoading(false);
    }
  }, [currentUser, toast, token]);

  useEffect(() => { void loadData(); }, [loadData]);

  if (authLoading || !currentUser) return <div>Loading...</div>;
  if (!isAuthorized) return <UnauthorizedComponent />;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Governance</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Compliance setup</h1>
        <p className="mt-1 text-muted-foreground">Define what each job needs and what each project role is responsible for.</p>
      </header>

      {loading ? <div className="flex min-h-48 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div> : (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div><CardTitle className="flex items-center gap-2"><BriefcaseBusiness className="h-5 w-5" /> Job positions</CardTitle><CardDescription>Certificate and credential rules attached to a worker’s position.</CardDescription></div>
              <Button size="sm" onClick={() => setPositionEditor('new')}><Plus className="mr-2 h-4 w-4" /> Add</Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {positions.length ? positions.map((position) => (
                <div key={position.id} className="rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div><div className="flex items-center gap-2"><p className="font-semibold">{position.name}</p><Badge variant={position.isActive ? 'secondary' : 'outline'}>{position.isActive ? 'Active' : 'Inactive'}</Badge></div>{position.description ? <p className="mt-1 text-sm text-muted-foreground">{position.description}</p> : null}</div>
                    <Button variant="ghost" size="icon" onClick={() => setPositionEditor(position)} aria-label={`Edit ${position.name}`}><Pencil className="h-4 w-4" /></Button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {position.credentialRequirements.length ? position.credentialRequirements.map((requirement) => <Badge key={requirement.certificateTypeId} variant="outline"><BadgeCheck className="mr-1 h-3.5 w-3.5" />{requirement.certificateTypeName}{requirement.minimumValidityDays ? ` · ${requirement.minimumValidityDays} days remaining` : ''}</Badge>) : <span className="text-sm text-muted-foreground">No credentials required.</span>}
                  </div>
                </div>
              )) : <EmptyState text="No job positions have been configured." />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Workflow roles</CardTitle><CardDescription>Flexible duties used when assigning people to projects.</CardDescription></div>
              <Button size="sm" onClick={() => setRoleEditor('new')}><Plus className="mr-2 h-4 w-4" /> Add</Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {roles.length ? roles.map((role) => (
                <div key={role.id} className="rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><p className="font-semibold">{role.name}</p>{role.isDefault ? <Badge>Default</Badge> : null}</div><p className="mt-1 text-sm text-muted-foreground">{role.dutyKeys.length} assigned {role.dutyKeys.length === 1 ? 'duty' : 'duties'}</p></div><Button variant="ghost" size="icon" onClick={() => setRoleEditor(role)} aria-label={`Edit ${role.name}`}><Pencil className="h-4 w-4" /></Button></div>
                  <div className="mt-3 flex flex-wrap gap-2">{role.dutyKeys.length ? role.dutyKeys.map((key) => <Badge key={key} variant="outline">{KNOWN_WORKFLOW_DUTIES.find((duty) => duty.key === key)?.label ?? key}</Badge>) : <span className="text-sm text-muted-foreground">No duties assigned.</span>}</div>
                </div>
              )) : <EmptyState text="No workflow roles have been configured." />}
            </CardContent>
          </Card>
        </div>
      )}

      <JobPositionEditor openValue={positionEditor} certificateTypes={certificateTypes} onClose={() => setPositionEditor(null)} onSaved={() => { setPositionEditor(null); void loadData(); }} />
      <ProjectRoleEditor openValue={roleEditor} onClose={() => setRoleEditor(null)} onSaved={() => { setRoleEditor(null); void loadData(); }} />
    </div>
  );
}

function EmptyState({ text }: { text: string }) { return <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{text}</div>; }

function JobPositionEditor({ openValue, certificateTypes, onClose, onSaved }: { openValue: JobPosition | 'new' | null; certificateTypes: CertificateType[]; onClose: () => void; onSaved: () => void }) {
  const { token } = useSession();
  const { toast } = useToast();
  const editing = openValue && openValue !== 'new' ? openValue : null;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [requirements, setRequirements] = useState<RequirementDraft[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(editing?.name ?? ''); setDescription(editing?.description ?? ''); setIsActive(editing?.isActive ?? true);
    setRequirements(editing?.credentialRequirements.map(({ certificateTypeId, minimumValidityDays }) => ({ certificateTypeId, minimumValidityDays })) ?? []);
  }, [editing, openValue]);

  const selected = useMemo(() => new Set(requirements.map((item) => item.certificateTypeId)), [requirements]);
  const save = async () => {
    if (!token || !name.trim()) return;
    setSaving(true);
    try {
      const input = { name: name.trim(), description: description.trim() || null, credentialRequirements: requirements };
      if (editing) await updateJobPositionRequest(token, editing.id, { ...input, isActive }); else await createJobPositionRequest(token, input);
      toast({ title: editing ? 'Job position updated' : 'Job position created' }); onSaved();
    } catch (error) { toast({ variant: 'destructive', title: 'Could not save job position', description: error instanceof Error ? error.message : 'Try again.' }); } finally { setSaving(false); }
  };

  return <Dialog open={openValue !== null} onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>{editing ? 'Edit job position' : 'Add job position'}</DialogTitle><DialogDescription>Choose the credentials a person must hold for this job.</DialogDescription></DialogHeader><div className="max-h-[65vh] space-y-5 overflow-y-auto pr-2"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="position-name">Name</Label><Input id="position-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Crane operator" /></div>{editing ? <label className="flex items-center gap-3 self-end rounded-lg border p-3"><Checkbox checked={isActive} onCheckedChange={(value) => setIsActive(value === true)} /> Active and assignable</label> : null}</div><div className="space-y-2"><Label htmlFor="position-description">Description</Label><Textarea id="position-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Optional responsibilities or scope" /></div><div className="space-y-2"><Label>Required certificates and credentials</Label>{certificateTypes.length ? <div className="space-y-2">{certificateTypes.map((certificate) => { const requirement = requirements.find((item) => item.certificateTypeId === certificate.id); return <div key={certificate.id} className="grid grid-cols-[1fr_9rem] items-center gap-3 rounded-lg border p-3"><label className="flex items-center gap-3"><Checkbox checked={selected.has(certificate.id)} onCheckedChange={(checked) => setRequirements((current) => checked === true ? [...current, { certificateTypeId: certificate.id, minimumValidityDays: 0 }] : current.filter((item) => item.certificateTypeId !== certificate.id))} />{certificate.name}</label><Input type="number" min={0} max={36500} disabled={!requirement} value={requirement?.minimumValidityDays ?? 0} onChange={(event) => setRequirements((current) => current.map((item) => item.certificateTypeId === certificate.id ? { ...item, minimumValidityDays: Math.min(36500, Math.max(0, Number(event.target.value) || 0)) } : item))} aria-label={`${certificate.name} minimum validity days`} /></div>; })}</div> : <p className="text-sm text-muted-foreground">Create certificate types first, then return here to require them.</p>}</div></div><DialogFooter><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={() => void save()} disabled={saving || !name.trim()}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save position</Button></DialogFooter></DialogContent></Dialog>;
}

function ProjectRoleEditor({ openValue, onClose, onSaved }: { openValue: ProjectRole | 'new' | null; onClose: () => void; onSaved: () => void }) {
  const { token } = useSession();
  const { toast } = useToast();
  const editing = openValue && openValue !== 'new' ? openValue : null;
  const [name, setName] = useState('');
  const [duties, setDuties] = useState<string[]>([]);
  const [customDuties, setCustomDuties] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { const keys = editing?.dutyKeys ?? []; setName(editing?.name ?? ''); setDuties(keys.filter((key) => KNOWN_WORKFLOW_DUTIES.some((duty) => duty.key === key))); setCustomDuties(keys.filter((key) => !KNOWN_WORKFLOW_DUTIES.some((duty) => duty.key === key)).join('\n')); }, [editing, openValue]);
  const save = async () => {
    if (!token || !name.trim()) return;
    setSaving(true);
    try {
      const dutyKeys = normalizeDutyKeys([...duties, ...customDuties.split(/[\n,]/)]);
      const input = { name: name.trim(), dutyKeys, grantsFullProjectAccess: dutyKeys.includes('project.full-access'), canManageCrew: dutyKeys.includes('project.manage-crew'), isSecondSignatory: dutyKeys.includes('work-pass.final-approve') };
      if (editing) await updateProjectRoleRequest(token, editing.id, input); else await createProjectRoleRequest(token, input);
      toast({ title: editing ? 'Workflow role updated' : 'Workflow role created' }); onSaved();
    } catch (error) { toast({ variant: 'destructive', title: 'Could not save workflow role', description: error instanceof Error ? error.message : 'Try again.' }); } finally { setSaving(false); }
  };

  return <Dialog open={openValue !== null} onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>{editing ? 'Edit workflow role' : 'Add workflow role'}</DialogTitle><DialogDescription>Duties describe the workflow actions this role may perform on a project.</DialogDescription></DialogHeader><div className="space-y-5"><div className="space-y-2"><Label htmlFor="role-name">Role name</Label><Input id="role-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. HSE final approver" /></div><div className="space-y-2"><Label>Standard duties</Label>{KNOWN_WORKFLOW_DUTIES.map((duty) => <label key={duty.key} className="flex items-center gap-3 rounded-lg border p-3"><Checkbox checked={duties.includes(duty.key)} onCheckedChange={(checked) => setDuties((current) => checked === true ? [...current, duty.key] : current.filter((key) => key !== duty.key))} /><span><span className="block text-sm font-medium">{duty.label}</span><span className="block text-xs text-muted-foreground">{duty.key}</span></span></label>)}</div><div className="space-y-2"><Label htmlFor="custom-duties">Custom duties</Label><Textarea id="custom-duties" value={customDuties} onChange={(event) => setCustomDuties(event.target.value)} placeholder="permit.issue&#10;inspection.close" /><p className="text-xs text-muted-foreground">One key per line. Use letters, numbers, dots, dashes, or underscores.</p></div></div><DialogFooter><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={() => void save()} disabled={saving || !name.trim()}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save role</Button></DialogFooter></DialogContent></Dialog>;
}
