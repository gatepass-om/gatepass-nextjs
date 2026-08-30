
'use client';

import { useState, useEffect, useMemo, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RequestsTable } from "@/components/access-requests/requests-table";
import { SupervisorRequestForm } from "@/components/access-requests/supervisor-request-form";
import type { AccessRequest, Site, Operator, Contractor } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { useAuthProtection } from "@/hooks/use-auth-protection";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
  const { currentUser, loading: authLoading, isAuthorized, UnauthorizedComponent } = useAuthProtection(['Admin', 'Operator Admin', 'Contractor Admin', 'Manager', 'Worker', 'Supervisor']);
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

  const [isNewRequestOpen, setIsNewRequestOpen] = useState(false);

  const defaultTab = isManager ? "approve" : "my-requests-log";

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

      const [sitesData, operatorsData, contractorsData, requestResult, pendingResult] = await Promise.all([
        listSitesRequest(token),
        listOperatorsRequest(token),
        listContractorsRequest(token),
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

  const handleConfirmDeny = async (requestId: string, reason: string): Promise<boolean> => {
    if (!token) return false;
    try {
      await updateAccessRequest(token, requestId, { status: 'Denied', decisionReason: reason });
      toast({ title: 'Request Denied', description: 'The request has been denied with a recorded reason.' });
      void fetchRequests();
      return true;
    } catch (error) {
      console.error('Error denying request:', error);
      toast({ variant: 'destructive', title: 'Action Failed', description: 'Could not deny the request.' });
      return false;
    }
  };

  const handleConfirmApproval = async (requestId: string, validFrom: Date, expiresAt: Date | 'Permanent'): Promise<boolean> => {
    if (!token) {
      toast({ variant: "destructive", title: "Session expired", description: "Please log in again to continue." });
      return false;
    }

    try {
      await updateAccessRequest(token, requestId, buildAccessApprovalUpdate(validFrom, expiresAt));
      toast({ title: 'Request Approved', description: 'The access request has been approved.' });
      void fetchRequests();
      return true;
    } catch (error) {
      console.error('Error approving request:', error);
      toast({ variant: 'destructive', title: 'Approval Failed', description: 'Could not approve the request.' });
      return false;
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

    if (isManager) {
      tabs.push({ value: "approve", label: "To review" });
    }

    if (isSupervisor || isWorker || isManager) {
      tabs.push({ value: "my-requests-log", label: "All requests" });
    }
    return tabs;
  };

  const visibleTabs = getVisibleTabs();

  return (
    <div className="space-y-4 md:space-y-5">
      <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Site Access</h1>
          <p className="text-sm text-muted-foreground">Review, approve, and track site access.</p>
        </div>
        {isSupervisor && (
          <Dialog open={isNewRequestOpen} onOpenChange={setIsNewRequestOpen}>
            <Button onClick={() => setIsNewRequestOpen(true)}>
              <FilePlus2 className="mr-2 h-4 w-4" />
              New request
            </Button>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Submit Group Site Access Request</DialogTitle>
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
              title="All requests"
              description="Every site access request in your scope, regardless of status."
              requests={myRequests}
              isLoading={loading}
              onDelete={canDelete ? handleDeleteRequest : undefined}
            />
            <PaginationControls
              noun="site access requests"
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
              title="To review"
              description="These requests are waiting for your decision."
              requests={pendingRequests}
              showActions={true}
              onConfirmApprove={handleConfirmApproval}
              onConfirmDeny={handleConfirmDeny}
              onDelete={canDelete ? handleDeleteRequest : undefined}
              isLoading={loading}
            />
            <PaginationControls
              noun="pending site access requests"
              page={pendingPage}
              totalPages={pendingTotalPages}
              hasPreviousPage={pendingHasPreviousPage}
              hasNextPage={pendingHasNextPage}
              onPageChange={setPendingPage}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
