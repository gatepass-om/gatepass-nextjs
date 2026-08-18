
'use client';

import { useState, useEffect, useMemo, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RequestsTable } from "@/components/access-requests/requests-table";
import { SupervisorRequestForm } from "@/components/access-requests/supervisor-request-form";
import type { AccessRequest, Site, Operator, Contractor } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { useAuthProtection } from "@/hooks/use-auth-protection";
import { ApprovalDialog } from "@/components/access-requests/approval-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FilePlus2 } from "lucide-react";
import { useSession } from "@/providers/session-provider";
import { apiRequest, listAccessRequestsPageRequest, listSitesRequest, listOperatorsRequest, listContractorsRequest, updateAccessRequest, deleteAccessRequest } from "@/lib/api";
import { usePolling } from "@/lib/polling";
import { useLiveEvents } from "@/hooks/use-live-events";
import { RequestWorkflowStrip } from "@/components/access-requests/request-workflow-strip";
import { buildAccessApprovalUpdate } from "@/lib/access-request-contract";
import { PaginationControls } from "@/components/ui/pagination-controls";
import {
  ProjectWorkPassQueue,
  type ProjectWorkPassRecord,
} from "@/components/access-requests/project-work-pass-queue";
import type { ProjectRecord } from "@/components/projects/project-wizard-dialog";
import { getWorkPassQueueItems, type WorkPassAction } from "@/components/projects/project-command-center";

const ACCESS_REQUEST_PAGE_SIZE = 20;

export default function AccessRequestsPage() {
  const { currentUser, loading: authLoading, isAuthorized, UnauthorizedComponent } = useAuthProtection(['Admin', 'Operator Admin', 'Contractor Admin', 'Manager', 'Worker', 'Supervisor']);
  const { token } = useSession();
  const { toast } = useToast();

  const isManager = useMemo(() => currentUser?.role === 'Manager' || currentUser?.role === 'Operator Admin' || currentUser?.role === 'Admin', [currentUser?.role]);
  const isSupervisor = useMemo(() => currentUser?.role === 'Supervisor' || currentUser?.role === 'Contractor Admin' || currentUser?.role === 'Admin', [currentUser?.role]);
  const isWorker = useMemo(() => currentUser?.role === 'Worker', [currentUser?.role]);
  const canViewProjectWorkPasses = !isWorker;
  const canDelete = useMemo(() => ['Admin', 'Operator Admin', 'Manager'].includes(currentUser?.role ?? ''), [currentUser?.role]);

  const [myRequests, setMyRequests] = useState<AccessRequest[]>([]);
  const [pendingRequests, setPendingRequests] = useState<AccessRequest[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [projectWorkPasses, setProjectWorkPasses] = useState<ProjectWorkPassRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestPage, setRequestPage] = useState(1);
  const [requestTotalPages, setRequestTotalPages] = useState(0);
  const [requestHasPreviousPage, setRequestHasPreviousPage] = useState(false);
  const [requestHasNextPage, setRequestHasNextPage] = useState(false);
  const [pendingPage, setPendingPage] = useState(1);
  const [pendingTotalPages, setPendingTotalPages] = useState(0);
  const [pendingHasPreviousPage, setPendingHasPreviousPage] = useState(false);
  const [pendingHasNextPage, setPendingHasNextPage] = useState(false);

  const [approvalRequest, setApprovalRequest] = useState<AccessRequest | null>(null);
  const [denyRequest, setDenyRequest] = useState<AccessRequest | null>(null);
  const [denyReason, setDenyReason] = useState('');
  const [denyBusy, setDenyBusy] = useState(false);
  const [isNewRequestOpen, setIsNewRequestOpen] = useState(false);
  const [busyWorkPassId, setBusyWorkPassId] = useState<string | null>(null);
  const [rejectWorkPass, setRejectWorkPass] = useState<ProjectWorkPassRecord | null>(null);
  const [workPassRejectReason, setWorkPassRejectReason] = useState('');

  const workPassQueueItems = useMemo(() => getWorkPassQueueItems(
    projectWorkPasses,
    projects,
    { id: currentUser?.id, role: currentUser?.role },
  ), [projectWorkPasses, projects, currentUser?.id, currentUser?.role]);
  const defaultTab = useMemo(() => {
    if (workPassQueueItems.some((item) => item.actions.length > 0)) return "work-passes";
    if (isManager) return "approve";
    return "my-requests-log";
  }, [isManager, workPassQueueItems]);

  const fetchRequests = useCallback(async () => {
    if (!token || !currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const requestFilter: { supervisorId?: string; workerId?: string } = {};
      if (isWorker) {
        requestFilter.workerId = currentUser.id;
      } else if (currentUser.role === 'Supervisor') {
        requestFilter.supervisorId = currentUser.id;
      }

      const [sitesData, operatorsData, contractorsData, projectsData, workPassData, requestResult, pendingResult] = await Promise.all([
        listSitesRequest(token),
        listOperatorsRequest(token),
        listContractorsRequest(token),
        canViewProjectWorkPasses ? apiRequest<ProjectRecord[]>('/projects', { token }) : Promise.resolve([]),
        canViewProjectWorkPasses ? apiRequest<ProjectWorkPassRecord[]>('/work-passes', { token }) : Promise.resolve([]),
        listAccessRequestsPageRequest(token, {
          ...requestFilter,
          page: requestPage,
          pageSize: ACCESS_REQUEST_PAGE_SIZE,
        }),
        isManager ? listAccessRequestsPageRequest(token, {
          status: 'Pending',
          page: pendingPage,
          pageSize: ACCESS_REQUEST_PAGE_SIZE,
        }) : Promise.resolve(null),
      ]);

      const mappedSites = (sitesData as any[]).map((site) => ({
        id: site.id,
        name: site.name,
        operatorId: site.operator?.id ?? site.operatorId,
        managerIds: site.managerIds ?? [],
        requiredCertificates: site.requiredCertificates ?? [],
        requiresAccessApproval: site.requiresAccessApproval ?? true,
        usesSecurityCheckpoints: site.usesSecurityCheckpoints ?? true,
        usesSmartAccess: site.usesSmartAccess ?? true,
      })) as Site[];

      setSites(mappedSites);
      setOperators(operatorsData as Operator[]);
      setContractors(contractorsData as Contractor[]);
      setProjects(projectsData);
      setProjectWorkPasses(workPassData);
      setMyRequests(requestResult.items);
      setRequestTotalPages(requestResult.totalPages);
      setRequestHasPreviousPage(requestResult.hasPreviousPage);
      setRequestHasNextPage(requestResult.hasNextPage);

      if (pendingResult) {
        setPendingRequests(pendingResult.items);
        setPendingTotalPages(pendingResult.totalPages);
        setPendingHasPreviousPage(pendingResult.hasPreviousPage);
        setPendingHasNextPage(pendingResult.hasNextPage);
      } else {
        setPendingRequests([]);
        setPendingTotalPages(0);
        setPendingHasPreviousPage(false);
        setPendingHasNextPage(false);
      }
    } catch (error) {
      console.error('Failed to fetch access request data', error);
    } finally {
      setLoading(false);
    }
  }, [token, currentUser, isWorker, isManager, canViewProjectWorkPasses, requestPage, pendingPage]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Live: a created/approved/denied/expired request anywhere in scope refreshes the queue immediately.
  useLiveEvents(useCallback((event) => {
    if (event.type === 'AccessRequestChanged') {
      void fetchRequests();
    }
  }, [fetchRequests]));
  usePolling(() => {
    void fetchRequests();
  }, 45000);

  const handleOpenApprovalDialog = (request: AccessRequest) => {
    setApprovalRequest(request);
  };

  // Open the deny dialog so a reason can be captured. The backend requires a decisionReason when denying (it's
  // recorded on the request's audit trail), so we never deny without one.
  const handleOpenDenyDialog = (requestId: string) => {
    const request = pendingRequests.find((r) => r.id === requestId)
      ?? myRequests.find((r) => r.id === requestId)
      ?? null;
    setDenyReason('');
    setDenyRequest(request);
  };

  const handleConfirmDeny = async () => {
    if (!token || !denyRequest) return;
    if (!denyReason.trim()) {
      toast({ variant: 'destructive', title: 'Reason required', description: 'Enter a reason for denying this request.' });
      return;
    }

    setDenyBusy(true);
    try {
      await updateAccessRequest(token, denyRequest.id, { status: 'Denied', decisionReason: denyReason.trim() });
      toast({ title: 'Request Denied', description: 'The request has been denied with a recorded reason.' });
      setDenyRequest(null);
      setDenyReason('');
      void fetchRequests();
    } catch (error) {
      console.error('Error denying request:', error);
      toast({ variant: 'destructive', title: 'Action Failed', description: 'Could not deny the request.' });
    } finally {
      setDenyBusy(false);
    }
  };

  const handleConfirmApproval = async (requestId: string, validFrom: Date, expiresAt: Date | 'Permanent') => {
    if (!token) {
      toast({ variant: "destructive", title: "Session expired", description: "Please log in again to continue." });
      return;
    }

    try {
      await updateAccessRequest(token, requestId, buildAccessApprovalUpdate(validFrom, expiresAt));
      toast({ title: 'Request Approved', description: 'The access request has been approved.' });
      void fetchRequests();
    } catch (error) {
      console.error('Error approving request:', error);
      toast({ variant: 'destructive', title: 'Approval Failed', description: 'Could not approve the request.' });
    } finally {
      setApprovalRequest(null);
    }
  };

  const handleWorkPassAction = async (
    workPass: ProjectWorkPassRecord,
    action: Exclude<WorkPassAction, 'reject'>,
  ) => {
    if (!token) return;
    setBusyWorkPassId(workPass.id);
    try {
      const result = await apiRequest<ProjectWorkPassRecord | { workPass: ProjectWorkPassRecord; warnings: string[] }>(
        `/work-passes/${workPass.id}/${action}`,
        { method: 'POST', token },
      );
      const warnings = 'warnings' in result ? result.warnings : [];
      toast({
        title: action === 'submit' ? 'Work pass submitted' : 'Work pass approved',
        description: warnings.length > 0
          ? `Approved with compliance follow-up: ${warnings.join(' ')}`
          : `${workPass.passNumber} moved to the next workflow stage.`,
      });
      await fetchRequests();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Work-pass action failed',
        description: error instanceof Error ? error.message : 'The work pass could not be updated.',
      });
    } finally {
      setBusyWorkPassId(null);
    }
  };

  const handleConfirmWorkPassReject = async () => {
    if (!token || !rejectWorkPass || !workPassRejectReason.trim()) return;
    setBusyWorkPassId(rejectWorkPass.id);
    try {
      await apiRequest(`/work-passes/${rejectWorkPass.id}/reject`, {
        method: 'POST',
        token,
        body: { reason: workPassRejectReason.trim() },
      });
      toast({ title: 'Work pass rejected', description: `${rejectWorkPass.passNumber} was returned with a reason.` });
      setRejectWorkPass(null);
      setWorkPassRejectReason('');
      await fetchRequests();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Work-pass rejection failed',
        description: error instanceof Error ? error.message : 'The work pass could not be rejected.',
      });
    } finally {
      setBusyWorkPassId(null);
    }
  };

  const handleDeleteRequest = async (request: AccessRequest) => {
    if (!token) {
      toast({ variant: "destructive", title: "Session expired", description: "Please log in again to continue." });
      return;
    }

    try {
      await deleteAccessRequest(token, request.id);
      toast({ title: 'Request Deleted', description: `Access request for ${request.siteName} has been deleted.` });
      void fetchRequests();
    } catch (error) {
      console.error('Error deleting request:', error);
      toast({ variant: 'destructive', title: 'Delete Failed', description: 'Could not delete the request.' });
    }
  };

  if (authLoading || !currentUser) {
    return <div>Loading...</div>;
  }

  if (!isAuthorized) {
    return <UnauthorizedComponent />;
  }

  const getVisibleTabs = () => {
    const tabs = [];

    if (canViewProjectWorkPasses) {
      tabs.push({ value: "work-passes", label: "Project Work Passes" });
    }

    if (isSupervisor || isWorker || isManager) {
      tabs.push({ value: "my-requests-log", label: "Requests Log" });
    }

    if (isManager) {
      tabs.push({ value: "approve", label: "Approve Requests" });
    }
    return tabs;
  };

  const visibleTabs = getVisibleTabs();

  return (
    <div className="space-y-4 md:space-y-5">
      <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Access Request Workflow</h1>
          <p className="text-sm text-muted-foreground">Create, review, approve, and track governed access windows.</p>
        </div>
        {isSupervisor && (
          <Dialog open={isNewRequestOpen} onOpenChange={setIsNewRequestOpen}>
            <Button onClick={() => setIsNewRequestOpen(true)}>
              <FilePlus2 className="mr-2 h-4 w-4" />
              New request
            </Button>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Submit Group Access Request</DialogTitle>
                <DialogDescription>
                  Fill out the contract details and provide the list of workers requiring access.
                </DialogDescription>
              </DialogHeader>
              <SupervisorRequestForm
                supervisor={currentUser}
                operators={operators}
                sites={sites}
                contractors={contractors}
                isLoading={loading}
                onCancel={() => setIsNewRequestOpen(false)}
                onSuccess={() => {
                  setIsNewRequestOpen(false);
                  void fetchRequests();
                }}
              />
            </DialogContent>
          </Dialog>
        )}
      </header>
      <RequestWorkflowStrip requests={myRequests} pendingRequests={pendingRequests} isLoading={loading} />
      <Tabs defaultValue={defaultTab} key={defaultTab}>
        <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${visibleTabs.length}, 1fr)` }}>
          {visibleTabs.map(tab => <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>)}
        </TabsList>

        {canViewProjectWorkPasses && (
          <TabsContent value="work-passes">
            <ProjectWorkPassQueue
              workPasses={projectWorkPasses}
              projects={projects}
              actor={{ id: currentUser.id, role: currentUser.role }}
              isLoading={loading}
              busyWorkPassId={busyWorkPassId}
              onAction={(workPass, action) => void handleWorkPassAction(workPass, action)}
              onReject={(workPass) => {
                setRejectWorkPass(workPass);
                setWorkPassRejectReason('');
              }}
            />
          </TabsContent>
        )}

        {(isSupervisor || isWorker || isManager) && (
          <TabsContent value="my-requests-log">
            <RequestsTable
              title="Requests Log"
              description="A log of all access requests relevant to you."
              requests={myRequests}
              isLoading={loading}
              onDelete={canDelete ? handleDeleteRequest : undefined}
            />
            <PaginationControls
              noun="access requests"
              page={requestPage}
              totalPages={requestTotalPages}
              hasPreviousPage={requestHasPreviousPage}
              hasNextPage={requestHasNextPage}
              onPageChange={setRequestPage}
            />
          </TabsContent>
        )}

        {isManager && (
          <TabsContent value="approve">
            <RequestsTable
              title="Pending Approval"
              description="These requests are waiting for your approval."
              requests={pendingRequests}
              showActions={true}
              onApprove={handleOpenApprovalDialog}
              onDeny={handleOpenDenyDialog}
              onDelete={canDelete ? handleDeleteRequest : undefined}
              isLoading={loading}
            />
            <PaginationControls
              noun="pending access requests"
              page={pendingPage}
              totalPages={pendingTotalPages}
              hasPreviousPage={pendingHasPreviousPage}
              hasNextPage={pendingHasNextPage}
              onPageChange={setPendingPage}
            />
          </TabsContent>
        )}
      </Tabs>

      {approvalRequest && (
        <ApprovalDialog
          request={approvalRequest}
          onOpenChange={() => setApprovalRequest(null)}
          onConfirm={handleConfirmApproval}
        />
      )}

      <Dialog open={!!denyRequest} onOpenChange={(open) => { if (!open) { setDenyRequest(null); setDenyReason(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Deny access request</DialogTitle>
            <DialogDescription>
              Record why this request is being denied. The reason is returned to the requester and kept on the audit trail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="deny-reason">Reason</Label>
            <Textarea
              id="deny-reason"
              value={denyReason}
              onChange={(e) => setDenyReason(e.target.value)}
              placeholder="e.g. Missing valid HSE induction certificate."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setDenyRequest(null); setDenyReason(''); }} disabled={denyBusy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDeny} disabled={denyBusy || !denyReason.trim()}>
              {denyBusy ? 'Denying…' : 'Deny request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectWorkPass} onOpenChange={(open) => { if (!open) { setRejectWorkPass(null); setWorkPassRejectReason(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject project work pass</DialogTitle>
            <DialogDescription>
              Record what the contractor must correct. The reason remains on the work-pass audit trail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="work-pass-reject-reason">Reason</Label>
            <Textarea
              id="work-pass-reject-reason"
              value={workPassRejectReason}
              onChange={(event) => setWorkPassRejectReason(event.target.value)}
              placeholder="e.g. Worker credentials are incomplete."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setRejectWorkPass(null); setWorkPassRejectReason(''); }} disabled={Boolean(busyWorkPassId)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void handleConfirmWorkPassReject()} disabled={!workPassRejectReason.trim() || Boolean(busyWorkPassId)}>
              {busyWorkPassId ? 'Rejecting…' : 'Reject work pass'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
