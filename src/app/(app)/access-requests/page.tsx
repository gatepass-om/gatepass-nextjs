
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
import { listAccessRequestsPageRequest, listSitesRequest, listOperatorsRequest, listContractorsRequest, updateAccessRequest, deleteAccessRequest } from "@/lib/api";
import { usePolling } from "@/lib/polling";
import { useLiveEvents } from "@/hooks/use-live-events";
import { RequestWorkflowStrip } from "@/components/access-requests/request-workflow-strip";
import { buildAccessApprovalUpdate } from "@/lib/access-request-contract";
import { PaginationControls } from "@/components/ui/pagination-controls";

const ACCESS_REQUEST_PAGE_SIZE = 20;

export default function AccessRequestsPage() {
  const { currentUser, loading: authLoading, isAuthorized, UnauthorizedComponent } = useAuthProtection(['Admin', 'Operator Admin', 'Contractor Admin', 'Manager', 'Worker', 'Supervisor', 'Consultant']);
  const { token } = useSession();
  const { toast } = useToast();

  const isManager = useMemo(() => currentUser?.role === 'Manager' || currentUser?.role === 'Operator Admin' || currentUser?.role === 'Admin', [currentUser?.role]);
  const isSupervisor = useMemo(() => currentUser?.role === 'Supervisor' || currentUser?.role === 'Contractor Admin' || currentUser?.role === 'Admin', [currentUser?.role]);
  const isWorker = useMemo(() => currentUser?.role === 'Worker', [currentUser?.role]);
  const canDelete = useMemo(() => ['Admin', 'Operator Admin', 'Manager'].includes(currentUser?.role ?? ''), [currentUser?.role]);

  const [myRequests, setMyRequests] = useState<AccessRequest[]>([]);
  const [pendingRequests, setPendingRequests] = useState<AccessRequest[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
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

  const defaultTab = useMemo(() => {
    if (isManager) return "approve";
    return "my-requests-log";
  }, [isManager]);

  const fetchRequests = useCallback(async () => {
    if (!token || !currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [sitesData, operatorsData, contractorsData] = await Promise.all([
        listSitesRequest(token),
        listOperatorsRequest(token),
        listContractorsRequest(token),
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

      const requestFilter: { supervisorId?: string; workerId?: string } = {};
      if (isWorker) {
        requestFilter.workerId = currentUser.id;
      } else if (currentUser.role === 'Supervisor') {
        requestFilter.supervisorId = currentUser.id;
      }

      const requestResult = await listAccessRequestsPageRequest(token, {
        ...requestFilter,
        page: requestPage,
        pageSize: ACCESS_REQUEST_PAGE_SIZE,
      });
      setMyRequests(requestResult.items);
      setRequestTotalPages(requestResult.totalPages);
      setRequestHasPreviousPage(requestResult.hasPreviousPage);
      setRequestHasNextPage(requestResult.hasNextPage);

      if (isManager) {
        const pendingResult = await listAccessRequestsPageRequest(token, {
          status: 'Pending',
          page: pendingPage,
          pageSize: ACCESS_REQUEST_PAGE_SIZE,
        });
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
  }, [token, currentUser, isWorker, isManager, requestPage, pendingPage]);

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
    </div>
  );
}
