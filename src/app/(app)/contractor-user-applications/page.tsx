'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuthProtection } from '@/hooks/use-auth-protection';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/providers/session-provider';
import { useLocale } from '@/providers/locale-provider';
import type { Contractor, ContractorUserApplication, Operator, Site } from '@/lib/types';
import type { ContractorUserApplicationOptions } from '@/lib/api';
import {
  approveContractorUserApplication,
  createContractorUserApplication,
  downloadContractorUserApplicationAttachment,
  listContractorUserApplications,
  getContractorUserApplicationOptions,
  listContractorsRequest,
  listOperatorsRequest,
  listSitesRequest,
  returnContractorUserApplication,
  reviewContractorUserApplication,
  submitContractorUserApplication,
  updateContractorUserApplication,
  uploadContractorUserApplicationAttachment,
  updateContractorUserApplicationOptions,
  withdrawContractorUserApplication,
} from '@/lib/api';

type FormState = {
  operatorId: string; contractorId: string; assignedSiteId: string; firstName: string; lastName: string;
  email: string; phone: string; civilId: string; civilIdExpiresAtUtc: string; position: string;
  requestedRole: 'ContractorAdmin' | 'Supervisor' | 'Worker'; location: string;
  assetType: string; assetSubClass: string; directorate: string; department: string;
  contractorRepresentativeName: string; contractorType: string; employeeType: string; remarks: string;
  certificateExpiresAtUtc: string; approvedAccountExpiresAtUtc: string; isSme: boolean; declarationAccepted: boolean;
  supervisorUserId: string; reviewerUserId: string;
};

const emptyForm: FormState = {
  operatorId: '', contractorId: '', assignedSiteId: '', firstName: '', lastName: '', email: '', phone: '', civilId: '',
  civilIdExpiresAtUtc: '', position: '', requestedRole: 'ContractorAdmin', location: '', assetType: '', assetSubClass: '',
  directorate: '', department: '', contractorRepresentativeName: '', contractorType: 'Contractor', employeeType: '', remarks: '',
  certificateExpiresAtUtc: '', approvedAccountExpiresAtUtc: '', isSme: false, declarationAccepted: false,
  supervisorUserId: '', reviewerUserId: '',
};

const emptyOptions: ContractorUserApplicationOptions = {
  assetTypes: [], assetSubClasses: [], directorates: [], departments: [], contractorTypes: [], employeeTypes: [],
  supervisorCandidates: [], reviewerCandidates: [],
};
const configurableOptionKeys = ['assetTypes', 'assetSubClasses', 'directorates', 'departments', 'contractorTypes', 'employeeTypes'] as const;

function statusLabel(status: ContractorUserApplication['status']) {
  return status === 'PendingHseApproval' ? 'Pending HSE approval' : status.replace(/([a-z])([A-Z])/g, '$1 $2');
}

export default function ContractorUserApplicationsPage() {
  const { currentUser, loading: authLoading, isAuthorized, UnauthorizedComponent } = useAuthProtection(['Admin', 'Operator Admin', 'Manager', 'Contractor Admin']);
  const { token } = useSession();
  const { t } = useLocale();
  const { toast } = useToast();
  const [items, setItems] = useState<ContractorUserApplication[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [options, setOptions] = useState<ContractorUserApplicationOptions>(emptyOptions);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [civilIdFile, setCivilIdFile] = useState<File | null>(null);
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canCreate = currentUser?.role === 'Contractor Admin' || currentUser?.role === 'Admin';
  const canDecide = ['Admin', 'Operator Admin', 'Manager'].includes(currentUser?.role ?? '');
  const canConfigure = ['Admin', 'Operator Admin'].includes(currentUser?.role ?? '');

  const reload = useCallback(async () => {
    if (!token) return;
    const [applicationPage, operatorRows, contractorRows, siteRows] = await Promise.all([
      listContractorUserApplications(token, page, 20), listOperatorsRequest(token), listContractorsRequest(token), listSitesRequest(token),
    ]);
    setItems(applicationPage.items);
    setTotalPages(applicationPage.totalPages);
    setTotalCount(applicationPage.totalCount);
    setOperators(operatorRows as Operator[]);
    setContractors(contractorRows as Contractor[]);
    setSites(siteRows as Site[]);
    setForm((current) => ({
      ...current,
      operatorId: current.operatorId || currentUser?.operatorId || operatorRows[0]?.id || '',
      contractorId: current.contractorId || currentUser?.contractorId || contractorRows[0]?.id || '',
    }));
  }, [token, currentUser?.operatorId, currentUser?.contractorId, page]);

  useEffect(() => { void reload().catch((error) => toast({ variant: 'destructive', title: 'Could not load applications', description: error instanceof Error ? error.message : 'Try again.' })); }, [reload, toast]);
  const eligibleSites = useMemo(() => sites.filter((site) => !form.operatorId || site.operatorId === form.operatorId), [sites, form.operatorId]);

  useEffect(() => {
    if (!token || !form.operatorId) return;
    void getContractorUserApplicationOptions(token, form.operatorId, form.contractorId || undefined)
      .then(setOptions)
      .catch((error) => toast({ variant: 'destructive', title: t('Could not load form options', 'تعذر تحميل خيارات النموذج'), description: error instanceof Error ? error.message : t('Try again.', 'حاول مرة أخرى.') }));
  }, [token, form.operatorId, form.contractorId, toast, t]);

  const update = (key: keyof FormState, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));

  const createAndSubmit = async () => {
    const editingApplication = items.find((item) => item.id === editingId);
    const hasCivilIdEvidence = Boolean(civilIdFile || editingApplication?.attachments.some((attachment) => attachment.type === 'CivilId'));
    if (!token || !hasCivilIdEvidence) {
      toast({ variant: 'destructive', title: 'Civil ID evidence required', description: 'Attach the Civil ID document before submitting.' });
      return;
    }
    if (!form.declarationAccepted) {
      toast({ variant: 'destructive', title: 'Affirmation required', description: 'Confirm that the submitted information is correct and true.' });
      return;
    }
    setBusy(true);
    try {
      const payload = {
        ...form,
        assignedSiteId: form.assignedSiteId || undefined,
        certificateExpiresAtUtc: form.certificateExpiresAtUtc ? new Date(form.certificateExpiresAtUtc).toISOString() : undefined,
        approvedAccountExpiresAtUtc: form.approvedAccountExpiresAtUtc ? new Date(form.approvedAccountExpiresAtUtc).toISOString() : undefined,
        civilIdExpiresAtUtc: new Date(form.civilIdExpiresAtUtc).toISOString(),
      };
      const saved = editingId
        ? await updateContractorUserApplication(token, editingId, payload)
        : await createContractorUserApplication(token, payload);
      setEditingId(saved.id);
      if (civilIdFile) await uploadContractorUserApplicationAttachment(token, saved.id, 'CivilId', civilIdFile);
      if (certificateFile) await uploadContractorUserApplicationAttachment(token, saved.id, 'Certificate', certificateFile);
      await submitContractorUserApplication(token, saved.id, true);
      setForm({ ...emptyForm, operatorId: form.operatorId, contractorId: form.contractorId });
      setEditingId(null);
      setCivilIdFile(null); setCertificateFile(null);
      await reload();
      toast({ title: 'Application submitted', description: 'The NAMA reviewer queue has been notified.' });
    } catch (error) {
      await reload().catch(() => undefined);
      toast({ variant: 'destructive', title: 'Submission failed', description: error instanceof Error ? error.message : 'Try again.' });
    } finally { setBusy(false); }
  };

  const startEdit = (item: ContractorUserApplication) => {
    setEditingId(item.id);
    setForm({
      operatorId: item.operatorId, contractorId: item.contractorId, assignedSiteId: item.assignedSiteId ?? '',
      firstName: item.firstName, lastName: item.lastName, email: item.email, phone: item.phone, civilId: item.civilId,
      civilIdExpiresAtUtc: item.civilIdExpiresAtUtc.slice(0, 10), position: item.position, requestedRole: item.requestedRole,
      location: item.location, assetType: item.assetType, assetSubClass: item.assetSubClass, directorate: item.directorate,
      department: item.department, contractorRepresentativeName: item.contractorRepresentativeName, contractorType: item.contractorType,
      employeeType: item.employeeType, remarks: item.remarks ?? '', certificateExpiresAtUtc: item.certificateExpiresAtUtc?.slice(0, 10) ?? '',
      approvedAccountExpiresAtUtc: item.approvedAccountExpiresAtUtc?.slice(0, 10) ?? '', isSme: item.isSme, declarationAccepted: false,
      supervisorUserId: item.supervisorUserId ?? '', reviewerUserId: item.reviewerUserId ?? '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const withdraw = async (item: ContractorUserApplication) => {
    if (!token || !window.confirm(`Withdraw the application for ${item.name}?`)) return;
    setBusy(true);
    try { await withdrawContractorUserApplication(token, item.id); await reload(); toast({ title: 'Application withdrawn' }); }
    catch (error) { toast({ variant: 'destructive', title: 'Could not withdraw', description: error instanceof Error ? error.message : 'Try again.' }); }
    finally { setBusy(false); }
  };

  const decide = async (item: ContractorUserApplication, action: 'review' | 'approve' | 'return') => {
    if (!token) return;
    const comments = window.prompt(action === 'return' ? 'Return comments (required)' : 'Decision comments (optional)', '') ?? '';
    if (action === 'return' && !comments.trim()) return;
    setBusy(true);
    try {
      if (action === 'review') await reviewContractorUserApplication(token, item.id, comments);
      if (action === 'approve') await approveContractorUserApplication(token, item.id, comments);
      if (action === 'return') await returnContractorUserApplication(token, item.id, comments);
      await reload();
      toast({ title: 'Decision recorded', description: 'The application and notifications were updated.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Decision failed', description: error instanceof Error ? error.message : 'Try again.' });
    } finally { setBusy(false); }
  };

  const saveOptions = async () => {
    if (!token || !form.operatorId) return;
    setBusy(true);
    try {
      const saved = await updateContractorUserApplicationOptions(token, form.operatorId, options);
      setOptions((current) => ({ ...saved, supervisorCandidates: current.supervisorCandidates, reviewerCandidates: current.reviewerCandidates }));
      toast({ title: t('Application options saved', 'تم حفظ خيارات الطلب') });
    } catch (error) {
      toast({ variant: 'destructive', title: t('Could not save options', 'تعذر حفظ الخيارات'), description: error instanceof Error ? error.message : t('Try again.', 'حاول مرة أخرى.') });
    } finally { setBusy(false); }
  };

  if (authLoading) return <div className="p-6">{t('Loading…', 'جارٍ التحميل…')}</div>;
  if (!isAuthorized) return <UnauthorizedComponent />;

  return <div className="space-y-6 p-4 md:p-6">
    <div><h1 className="text-2xl font-semibold">{t('Contractor user approvals', 'اعتمادات مستخدمي المقاولين')}</h1><p className="text-sm text-muted-foreground">{t('Contractor login accounts are created only after NAMA review and independent final approval.', 'لا يتم إنشاء حسابات المقاولين إلا بعد مراجعة نماء والموافقة النهائية المستقلة.')}</p></div>

    {canConfigure && form.operatorId && <Card>
      <CardHeader><CardTitle>{t('Operator application options', 'خيارات طلبات المشغل')}</CardTitle><CardDescription>{t('Control the approved choices shown to contractor administrators.', 'تحكم في الخيارات المعتمدة التي تظهر لمسؤولي المقاولين.')}</CardDescription></CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        {configurableOptionKeys.map((key) => <Field key={key} label={key.replace(/([A-Z])/g, ' $1').replace(/^./, (value) => value.toUpperCase())}><Textarea value={options[key].join('\n')} onChange={(event) => setOptions((current) => ({ ...current, [key]: event.target.value.split(/\n|,/).map((value) => value.trim()).filter(Boolean) }))} /></Field>)}
        <div className="md:col-span-2"><Button disabled={busy} onClick={saveOptions}>{t('Save options', 'حفظ الخيارات')}</Button></div>
      </CardContent>
    </Card>}

    {canCreate && <Card>
      <CardHeader><CardTitle>{editingId ? t('Correct returned application', 'تصحيح الطلب المعاد') : t('New contractor-user application', 'طلب مستخدم مقاول جديد')}</CardTitle><CardDescription>{t('Complete the NAMA pilot fields, attach evidence, and affirm the submission.', 'أكمل حقول تجربة نماء وأرفق المستندات وأكد صحة الطلب.')}</CardDescription></CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-3">
        <Field label="Operator"><select className="h-10 w-full rounded-md border bg-background px-3" value={form.operatorId} onChange={(event) => update('operatorId', event.target.value)}>{operators.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field>
        <Field label="Contractor company"><select className="h-10 w-full rounded-md border bg-background px-3" value={form.contractorId} disabled={currentUser?.role === 'Contractor Admin'} onChange={(event) => update('contractorId', event.target.value)}>{contractors.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field>
        <Field label="Location"><select className="h-10 w-full rounded-md border bg-background px-3" value={form.assignedSiteId} onChange={(event) => { update('assignedSiteId', event.target.value); update('location', eligibleSites.find((site) => site.id === event.target.value)?.name ?? ''); }}><option value="">Select location</option>{eligibleSites.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field>
        {(['firstName','lastName','email','phone','civilId','position','contractorRepresentativeName'] as const).map((key) => <Field key={key} label={key.replace(/([A-Z])/g, ' $1').replace(/^./, (value) => value.toUpperCase())}><Input type={key === 'email' ? 'email' : 'text'} value={form[key]} onChange={(event) => update(key, event.target.value)} required /></Field>)}
        <ConfiguredSelect label="Asset type" value={form.assetType} values={options.assetTypes} onChange={(value) => update('assetType', value)} />
        <ConfiguredSelect label="Asset sub class" value={form.assetSubClass} values={options.assetSubClasses} onChange={(value) => update('assetSubClass', value)} />
        <ConfiguredSelect label="Directorate" value={form.directorate} values={options.directorates} onChange={(value) => update('directorate', value)} />
        <ConfiguredSelect label="Department" value={form.department} values={options.departments} onChange={(value) => update('department', value)} />
        <ConfiguredSelect label="Contractor type" value={form.contractorType} values={options.contractorTypes} onChange={(value) => update('contractorType', value)} />
        <ConfiguredSelect label="Employee type" value={form.employeeType} values={options.employeeTypes} onChange={(value) => update('employeeType', value)} />
        <Field label="Civil ID expiry"><Input type="date" value={form.civilIdExpiresAtUtc} onChange={(event) => update('civilIdExpiresAtUtc', event.target.value)} required /></Field>
        <Field label="Requested role"><select className="h-10 w-full rounded-md border bg-background px-3" value={form.requestedRole} onChange={(event) => update('requestedRole', event.target.value)}><option value="ContractorAdmin">Contractor Admin</option><option value="Supervisor">Supervisor</option><option value="Worker">Worker</option></select></Field>
        <Field label={t('Supervisor (optional)', 'المشرف (اختياري)')}><select className="h-10 w-full rounded-md border bg-background px-3" value={form.supervisorUserId} onChange={(event) => update('supervisorUserId', event.target.value)}><option value="">{t('No supervisor', 'بدون مشرف')}</option>{options.supervisorCandidates.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field>
        <Field label={t('NAMA reviewer', 'مراجع نماء')}><select className="h-10 w-full rounded-md border bg-background px-3" value={form.reviewerUserId} onChange={(event) => update('reviewerUserId', event.target.value)}><option value="">{t('Any available manager', 'أي مدير متاح')}</option>{options.reviewerCandidates.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field>
        <Field label="Certificate expiry (if applicable)"><Input type="date" value={form.certificateExpiresAtUtc} onChange={(event) => update('certificateExpiresAtUtc', event.target.value)} /></Field>
        <Field label="Approved account expiry (optional)"><Input type="date" value={form.approvedAccountExpiresAtUtc} onChange={(event) => update('approvedAccountExpiresAtUtc', event.target.value)} /></Field>
        <Field label="Civil ID evidence"><Input type="file" accept=".pdf,image/*" onChange={(event) => setCivilIdFile(event.target.files?.[0] ?? null)} required /></Field>
        <Field label="Certificate evidence"><Input type="file" accept=".pdf,image/*" onChange={(event) => setCertificateFile(event.target.files?.[0] ?? null)} /></Field>
        <Field label="Remarks"><Textarea value={form.remarks} onChange={(event) => update('remarks', event.target.value)} /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isSme} onChange={(event) => update('isSme', event.target.checked)} /> SME contractor</label>
        <label className="flex items-start gap-2 text-sm md:col-span-2"><input className="mt-1" type="checkbox" checked={form.declarationAccepted} onChange={(event) => update('declarationAccepted', event.target.checked)} /><span>I affirm that all information and documents submitted are complete, correct and true.</span></label>
        <div className="flex gap-2 md:col-span-3"><Button disabled={busy} onClick={createAndSubmit}>{busy ? 'Submitting…' : editingId ? 'Update and resubmit' : 'Submit for NAMA review'}</Button>{editingId && <Button variant="outline" onClick={() => { setEditingId(null); setForm({ ...emptyForm, operatorId: form.operatorId, contractorId: form.contractorId }); }}>Cancel edit</Button>}</div>
      </CardContent>
    </Card>}

    <Card><CardHeader><CardTitle>{t('Applications', 'الطلبات')}</CardTitle><CardDescription>{totalCount} {t(totalCount === 1 ? 'application' : 'applications', 'طلب')} {t('in your scope', 'ضمن نطاقك')}</CardDescription></CardHeader><CardContent className="space-y-3">
      {items.length === 0 && <p className="text-sm text-muted-foreground">No contractor-user applications yet.</p>}
      {items.map((item) => <div key={item.id} className="rounded-lg border p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-medium">{item.name} · {item.position}</div><div className="text-sm text-muted-foreground">{item.contractorName} → {item.operatorName} · {item.email}</div></div><Badge variant="secondary">{statusLabel(item.status)}</Badge></div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground"><span>Role: {item.requestedRole.replace(/([a-z])([A-Z])/g, '$1 $2')}</span>{item.earliestExpiryAtUtc && <span>Earliest expiry: {new Date(item.earliestExpiryAtUtc).toLocaleDateString()}</span>}</div>
        <div className="mt-3 flex flex-wrap gap-2">{item.attachments.map((attachment) => <Button key={attachment.id} size="sm" variant="outline" onClick={() => token && downloadContractorUserApplicationAttachment(token, item.id, attachment)}>{attachment.type}: {attachment.fileName}</Button>)}
          {canDecide && item.status === 'Submitted' && <><Button size="sm" disabled={busy} onClick={() => decide(item, 'review')}>Complete review</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => decide(item, 'return')}>Return</Button></>}
          {canDecide && item.status === 'PendingHseApproval' && <><Button size="sm" disabled={busy} onClick={() => decide(item, 'approve')}>Approve account</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => decide(item, 'return')}>Return</Button></>}
          {canCreate && ['Draft', 'Returned'].includes(item.status) && <Button size="sm" onClick={() => startEdit(item)}>{item.status === 'Draft' ? 'Continue draft' : 'Correct and resubmit'}</Button>}
          {currentUser?.role === 'Contractor Admin' && !['Closed','Withdrawn','Expired'].includes(item.status) && <Button size="sm" variant="outline" disabled={busy} onClick={() => withdraw(item)}>Withdraw</Button>}
        </div>
        {(item.reviewerComments || item.approvalComments) && <div className="mt-3 rounded bg-muted p-2 text-sm">{item.reviewerComments && <div>Review: {item.reviewerComments}</div>}{item.approvalComments && <div>Approval: {item.approvalComments}</div>}</div>}
      </div>)}
      {totalPages > 1 && <div className="flex items-center justify-between border-t pt-4"><Button variant="outline" disabled={page <= 1 || busy} onClick={() => setPage((value) => value - 1)}>{t('Previous', 'السابق')}</Button><span className="text-sm text-muted-foreground">{t('Page', 'الصفحة')} {page} / {totalPages}</span><Button variant="outline" disabled={page >= totalPages || busy} onClick={() => setPage((value) => value + 1)}>{t('Next', 'التالي')}</Button></div>}
    </CardContent></Card>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

function ConfiguredSelect({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return <Field label={label}><select className="h-10 w-full rounded-md border bg-background px-3" value={value} onChange={(event) => onChange(event.target.value)} required><option value="">Select {label.toLowerCase()}</option>{values.map((option) => <option key={option} value={option}>{option}</option>)}</select></Field>;
}
