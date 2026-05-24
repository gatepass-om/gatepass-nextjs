'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, CheckCircle2, XCircle, ClipboardCheck } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useSession } from '@/providers/session-provider';
import { fetchPermits, issuePermit, cancelPermit, completePermit, type PermitToWork } from '@/lib/api';

const statusColor: Record<string, string> = {
    Active: 'bg-green-100 text-green-800',
    Expired: 'bg-yellow-100 text-yellow-800',
    Cancelled: 'bg-red-100 text-red-800',
    Completed: 'bg-blue-100 text-blue-800',
};

function PermitStatusBadge({ status }: { status: string }) {
    return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[status] ?? 'bg-gray-100 text-gray-700'}`}>
            {status}
        </span>
    );
}

export default function PermitsPage() {
    const { token, user } = useSession();
    const [permits, setPermits] = useState<PermitToWork[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [issueOpen, setIssueOpen] = useState(false);
    const [cancelId, setCancelId] = useState<string | null>(null);
    const [cancelReason, setCancelReason] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const [form, setForm] = useState({
        workerId: '',
        siteId: '',
        workDescription: '',
        validFromUtc: '',
        validToUtc: '',
    });

    const canManage = user?.role && ['Admin', 'OperatorAdmin', 'Manager', 'Supervisor'].includes(user.role);

    const load = async () => {
        if (!token) return;
        setLoading(true);
        setError(null);
        try {
            const data = await fetchPermits(token);
            setPermits(data);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Failed to load permits.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [token]);

    const handleIssue = async () => {
        if (!token) return;
        setSubmitting(true);
        try {
            await issuePermit(token, {
                workerId: form.workerId,
                siteId: form.siteId,
                workDescription: form.workDescription || undefined,
                validFromUtc: new Date(form.validFromUtc).toISOString(),
                validToUtc: new Date(form.validToUtc).toISOString(),
            });
            setIssueOpen(false);
            setForm({ workerId: '', siteId: '', workDescription: '', validFromUtc: '', validToUtc: '' });
            await load();
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Failed to issue permit.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancel = async () => {
        if (!token || !cancelId) return;
        setSubmitting(true);
        try {
            await cancelPermit(token, cancelId, cancelReason);
            setCancelId(null);
            setCancelReason('');
            await load();
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Failed to cancel permit.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleComplete = async (permitId: string) => {
        if (!token) return;
        try {
            await completePermit(token, permitId);
            await load();
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Failed to complete permit.');
        }
    };

    return (
        <div className="space-y-4 md:space-y-6">
            <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Permits to Work</h1>
                    <p className="text-muted-foreground">
                        Manage Permit-to-Work authorisations required for site access.
                    </p>
                </div>
                {canManage && (
                    <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" />
                                Issue Permit
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Issue Permit to Work</DialogTitle>
                                <DialogDescription>
                                    Complete all fields. The permit authorises the worker to access the specified site
                                    only within the stated time window.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-1.5">
                                    <Label>Worker ID</Label>
                                    <Input
                                        placeholder="Worker user ID"
                                        value={form.workerId}
                                        onChange={e => setForm(f => ({ ...f, workerId: e.target.value }))}
                                    />
                                </div>
                                <div className="grid gap-1.5">
                                    <Label>Site ID</Label>
                                    <Input
                                        placeholder="Site ID"
                                        value={form.siteId}
                                        onChange={e => setForm(f => ({ ...f, siteId: e.target.value }))}
                                    />
                                </div>
                                <div className="grid gap-1.5">
                                    <Label>Work Description</Label>
                                    <Textarea
                                        placeholder="Describe the work to be carried out…"
                                        value={form.workDescription}
                                        onChange={e => setForm(f => ({ ...f, workDescription: e.target.value }))}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-1.5">
                                        <Label>Valid From</Label>
                                        <Input
                                            type="datetime-local"
                                            value={form.validFromUtc}
                                            onChange={e => setForm(f => ({ ...f, validFromUtc: e.target.value }))}
                                        />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label>Valid To</Label>
                                        <Input
                                            type="datetime-local"
                                            value={form.validToUtc}
                                            onChange={e => setForm(f => ({ ...f, validToUtc: e.target.value }))}
                                        />
                                    </div>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIssueOpen(false)}>Cancel</Button>
                                <Button onClick={handleIssue} disabled={submitting}>
                                    {submitting ? 'Issuing…' : 'Issue Permit'}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                )}
            </header>

            {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-destructive text-sm">{error}</div>
            )}

            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
                </div>
            ) : permits.length === 0 ? (
                <Card>
                    <CardContent className="p-8 text-center text-muted-foreground">
                        No permits found.
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {permits.map(permit => (
                        <Card key={permit.id}>
                            <CardHeader className="pb-2">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                                            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                                            {permit.permitNumber}
                                        </CardTitle>
                                        <CardDescription className="mt-0.5">
                                            {permit.workerName} → {permit.siteName}
                                        </CardDescription>
                                    </div>
                                    <PermitStatusBadge status={permit.status} />
                                </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground mb-3">
                                    <span>
                                        <strong className="text-foreground">From:</strong>{' '}
                                        {format(parseISO(permit.validFromUtc), 'dd MMM yyyy HH:mm')}
                                    </span>
                                    <span>
                                        <strong className="text-foreground">To:</strong>{' '}
                                        {format(parseISO(permit.validToUtc), 'dd MMM yyyy HH:mm')}
                                    </span>
                                    <span>
                                        <strong className="text-foreground">Issued by:</strong>{' '}
                                        {permit.issuedByUserName}
                                    </span>
                                </div>
                                {permit.workDescription && (
                                    <p className="text-sm text-muted-foreground mb-3">{permit.workDescription}</p>
                                )}
                                {canManage && permit.status === 'Active' && (
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="text-green-700 border-green-300 hover:bg-green-50"
                                            onClick={() => handleComplete(permit.id)}
                                        >
                                            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                                            Mark Complete
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="text-destructive border-destructive/30 hover:bg-destructive/5"
                                            onClick={() => setCancelId(permit.id)}
                                        >
                                            <XCircle className="mr-1.5 h-3.5 w-3.5" />
                                            Cancel
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Cancel confirmation dialog */}
            <Dialog open={!!cancelId} onOpenChange={open => { if (!open) { setCancelId(null); setCancelReason(''); } }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Cancel Permit to Work</DialogTitle>
                        <DialogDescription>
                            This will immediately revoke the permit. The worker will be denied entry at the gate.
                            Please provide a reason.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label>Reason for cancellation</Label>
                        <Textarea
                            className="mt-1.5"
                            placeholder="e.g. Work postponed, worker no longer authorised…"
                            value={cancelReason}
                            onChange={e => setCancelReason(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setCancelId(null); setCancelReason(''); }}>
                            Back
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleCancel}
                            disabled={submitting || !cancelReason.trim()}
                        >
                            {submitting ? 'Cancelling…' : 'Cancel Permit'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
