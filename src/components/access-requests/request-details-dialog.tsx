
'use client'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AccessRequest, AccessRequestWorker } from "@/lib/types";
import { format, parseISO } from 'date-fns';
import { Briefcase, Building, CalendarClock, CheckCircle2, Contact, FileCheck2, Hash, ShieldAlert, ShieldCheck, ShieldX, Trash2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Textarea } from "../ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useState } from "react";

interface RequestDetailsDialogProps {
  request: AccessRequest;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete?: (request: AccessRequest) => void | Promise<void>;
  onApprove?: (request: AccessRequest) => void;
  onDeny?: (requestId: string) => void;
}

const WorkerDetails = ({ worker }: { worker: AccessRequestWorker }) => {
    const missingRequiredCerts = worker.missingCertificates ?? [];

    return (
        <div className="p-3 rounded-md bg-muted/50 border flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
                <div className="font-semibold">{worker.name}</div>
            </div>
            <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                <span>{worker.jobTitle || worker.role || 'N/A'}</span>
            </div>
             {missingRequiredCerts.length > 0 && (
                <div className="space-y-2">
                    {missingRequiredCerts.map((certName) => (
                        <div key={certName} className="flex items-start gap-2 text-sm text-destructive">
                             <ShieldAlert className="h-4 w-4 mt-0.5" />
                             <div>
                                 <p className="font-medium">{certName}</p>
                                 <p className="text-xs font-semibold">Missing Required Certificate</p>
                             </div>
                        </div>
                    ))}
                </div>
            )}

             {missingRequiredCerts.length === 0 && (
                <p className="text-xs text-success">No blocking certificate requirements.</p>
             )}
        </div>
    );
};


export function RequestDetailsDialog({ request, open, onOpenChange, onDelete, onApprove, onDeny }: RequestDetailsDialogProps) {
  const workersInRequest = request.workers;
  const [isDeleting, setIsDeleting] = useState(false);
  const workerCount = workersInRequest.length;
  const hasPendingDecision = request.status === 'Pending';
  const certificateIssues = workersInRequest.reduce((count, worker) => {
    return count + worker.missingCertificates.length;
  }, 0);

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(request);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to delete access request', error);
    } finally {
      setIsDeleting(false);
    }
  };
  

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[92vw] overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <SheetTitle>{request.siteName}</SheetTitle>
              <SheetDescription>
                Request from {request.contractorName} submitted by {request.supervisorName}.
              </SheetDescription>
            </div>
            <Badge className={request.status === 'Approved' ? 'bg-success/15 text-success border border-success/30 hover:bg-success/15' : request.status === 'Denied' ? 'bg-danger/15 text-danger border border-danger/30 hover:bg-danger/15' : 'bg-warning/15 text-warning border border-warning/30 hover:bg-warning/15'}>
              {request.status}
            </Badge>
          </div>
        </SheetHeader>
        <div className="space-y-5 py-6">
            <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-md border border-border p-3">
                    <div className="text-xs uppercase text-muted-foreground">Workers</div>
                    <div className="mt-1 text-2xl font-semibold">{workerCount}</div>
                </div>
                <div className="rounded-md border border-border p-3">
                    <div className="text-xs uppercase text-muted-foreground">On site</div>
                    <div className="mt-1 text-2xl font-semibold">{request.currentOnSiteCount}</div>
                </div>
                <div className="rounded-md border border-border p-3">
                    <div className="text-xs uppercase text-muted-foreground">Certificate holds</div>
                    <div className="mt-1 text-2xl font-semibold">{certificateIssues}</div>
                </div>
                <div className="rounded-md border border-border p-3">
                    <div className="text-xs uppercase text-muted-foreground">Decision</div>
                    <div className="mt-1 text-sm font-semibold">{request.status}</div>
                </div>
            </div>

            <div className="space-y-3 rounded-lg border border-border bg-background p-4">
                <h3 className="flex items-center gap-2 text-base font-semibold"><CalendarClock className="h-4 w-4" /> Workflow Timeline</h3>
                <div className="grid gap-3 md:grid-cols-3">
                    <TimelineItem icon={FileCheck2} title="Submitted" value={formatDateTime(request.requestedAtUtc)} active />
                    <TimelineItem icon={request.status === 'Denied' ? ShieldX : ShieldCheck} title="Decision" value={request.status === 'Pending' ? 'Awaiting approval' : request.status} active={request.status !== 'Pending'} />
                    <TimelineItem icon={CheckCircle2} title="Access Window" value={request.status === 'Approved' ? `${formatDate(request.validFromUtc ?? undefined)} to ${request.isPermanent ? 'Permanent' : formatDate(request.expiresAtUtc ?? undefined)}` : 'Not issued'} active={request.status === 'Approved'} />
                </div>
            </div>

            <div className="space-y-4 rounded-lg border border-border bg-background p-4">
                <h3 className="text-base font-semibold">Contract Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="grid w-full items-center gap-1.5">
                        <Label htmlFor="operatorName">Operator</Label>
                        <Input id="operatorName" value={request.operatorName} readOnly disabled icon={Building} />
                    </div>
                     <div className="grid w-full items-center gap-1.5">
                        <Label htmlFor="siteName">Site</Label>
                        <Input id="siteName" value={request.siteName} readOnly disabled icon={Building} />
                    </div>
                     <div className="grid w-full items-center gap-1.5">
                        <Label htmlFor="contractNumber">Contract Number</Label>
                        <Input id="contractNumber" value={request.contractNumber} readOnly disabled icon={Hash} />
                    </div>
                    <div className="grid w-full items-center gap-1.5">
                        <Label htmlFor="focalPoint">Focal Point</Label>
                        <Input id="focalPoint" value={request.focalPoint} readOnly disabled icon={Contact} />
                    </div>
                </div>
                 {request.notes && (
                    <div className="grid w-full items-center gap-1.5">
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea id="notes" value={request.notes} readOnly disabled className="h-24"/>
                    </div>
                )}
            </div>

            <div className="space-y-4 rounded-lg border border-border bg-background p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="flex items-center gap-2 text-base font-semibold"><Users className="h-5 w-5"/>Personnel Readiness ({workersInRequest.length})</h3>
                    <Badge variant="outline">{certificateIssues} blocking certificate holds</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {workersInRequest.length > 0 ? workersInRequest.map(worker => (
                        <WorkerDetails key={worker.userId} worker={worker} />
                    )) : (
                        <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground md:col-span-2">No worker details returned for this request.</div>
                    )}
                </div>
            </div>

        </div>
        <SheetFooter className="gap-2 sm:gap-0">
          {hasPendingDecision && onDeny && (
            <Button
              variant="outline"
              onClick={() => {
                onDeny(request.id);
                onOpenChange(false);
              }}
            >
              <ShieldX className="mr-2 h-4 w-4" />
              Deny
            </Button>
          )}
          {hasPendingDecision && onApprove && (
            <Button
              onClick={() => {
                onApprove(request);
                onOpenChange(false);
              }}
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              Approve
            </Button>
          )}
          {onDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="sm:mr-auto" disabled={isDeleting}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Request
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete access request?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove the request for {request.siteName}. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function formatDateTime(value?: string) {
    if (!value) return 'N/A';
    try {
        return format(parseISO(value), 'dd MMM yyyy, HH:mm');
    } catch {
        return 'Invalid date';
    }
}

function formatDate(value?: string) {
    if (!value) return 'N/A';
    try {
        return format(parseISO(value), 'dd MMM yyyy');
    } catch {
        return 'Invalid date';
    }
}

function TimelineItem({
    icon: Icon,
    title,
    value,
    active,
}: {
    icon: typeof FileCheck2;
    title: string;
    value: string;
    active: boolean;
}) {
    return (
        <div className="rounded-md border border-border p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
                <span className={cn('flex h-7 w-7 items-center justify-center rounded-md', active ? 'bg-accent/15 text-accent' : 'bg-muted text-muted-foreground')}>
                    <Icon className="h-4 w-4" />
                </span>
                {title}
            </div>
            <div className="mt-2 text-sm text-muted-foreground">{value}</div>
        </div>
    );
}

// Add icon prop to Input component's interface
declare module "react" {
    interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
        icon?: React.ElementType;
    }
}
