
'use client';

import { useState, useEffect, useMemo, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RequestsTable } from "@/components/access-requests/requests-table";
import { SupervisorRequestForm } from "@/components/access-requests/supervisor-request-form";
import type { AccessRequest, Site, Operator, Contractor } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { useAuthProtection } from "@/hooks/use-auth-protection";
import { ApprovalDialog } from "@/components/access-requests/approval-dialog";
import { useSession } from "@/providers/session-provider";
import { listAccessRequestsRequest, listSitesRequest, listOperatorsRequest, listContractorsRequest, updateAccessRequest, deleteAccessRequest } from "@/lib/api";
import { usePolling } from "@/lib/polling";
import { RequestWorkflowStrip } from "@/components/access-requests/request-workflow-strip";

export default function AccessRequestsPage() {
  const { firestoreUser, loading: authLoading, isAuthorized, UnauthorizedComponent } = useAuthProtection(['Admin', 'Operator Admin', 'Contractor Admin', 'Manager', 'Worker', 'Supervisor']);
  const { token } = useSession();
  const { toast } = useToast();

  const isManager = useMemo(() => firestoreUser?.role === 'Manager' || firestoreUser?.role === 'Operator Admin' || firestoreUser?.role === 'Admin', [firestoreUser?.role]);
  const isSupervisor = useMemo(() => firestoreUser?.role === 'Supervisor' || firestoreUser?.role === 'Contractor Admin' || firestoreUser?.role === 'Admin', [firestoreUser?.role]);
  const isWorker = useMemo(() => firestoreUser?.role === 'Worker', [firestoreUser?.role]);
  const canDelete = useMemo(() => ['Admin', 'Operator Admin', 'Manager'].includes(firestoreUser?.role ?? ''), [firestoreUser?.role]);

  const [myRequests, setMyRequests] = useState<AccessRequest[]>([]);
  const [pendingRequests, setPendingRequests] = useState<AccessRequest[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);

  const [approvalRequest, setApprovalRequest] = useState<AccessRequest | null>(null);

  const defaultTab = useMemo(() => {
    if (isSupervisor) return "group-request";
    if (isManager) return "approve";
    if (isWorker) return "my-requests-log";
    return "my-requests-log";
  }, [isSupervisor, isManager, isWorker]);

  const fetchRequests = useCallback(async () => {
    if (!token || !firestoreUser) {
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
      })) as Site[];

      setSites(mappedSites);
      setOperators(operatorsData as Operator[]);
      setContractors(contractorsData as Contractor[]);

      let requestList: AccessRequest[] = [];
      if (isWorker) {
        requestList = await listAccessRequestsRequest(token, { workerId: firestoreUser.id });
      } else if (firestoreUser.role === 'Supervisor') {
        requestList = await listAccessRequestsRequest(token, { supervisorId: firestoreUser.id });
      } else {
        requestList = await listAccessRequestsRequest(token);
      }

      const managedSiteIds = (() => {
        if (firestoreUser.role === 'Admin') {
          return mappedSites.map((site) => site.id);
        }
        if (firestoreUser.role === 'Operator Admin') {
          return mappedSites.filter((site) => site.operatorId === firestoreUser.operatorId).map((site) => site.id);
        }
        if (firestoreUser.role === 'Manager') {
          return mappedSites.filter((site) => site.managerIds.includes(firestoreUser.id)).map((site) => site.id);
        }
        return mappedSites.map((site) => site.id);
      })();

      let scopedRequests = requestList;
      if (['Manager', 'Operator Admin'].includes(firestoreUser.role)) {
        scopedRequests = requestList.filter((request) => managedSiteIds.includes(request.siteId));
      }

      setMyRequests(scopedRequests);

      if (isManager) {
        const pending = scopedRequests.filter((request) => request.status === 'Pending' && managedSiteIds.includes(request.siteId));
        setPendingRequests(pending);
      } else {
        setPendingRequests([]);
      }
    } catch (error) {
      console.error('Failed to fetch access request data', error);
    } finally {
      setLoading(false);
    }
  }, [token, firestoreUser, isWorker, isManager]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  usePolling(() => {
    void fetchRequests();
  }, 15000);

  const handleOpenApprovalDialog = (request: AccessRequest) => {
    setApprovalRequest(request);
  };

  const handleDenyRequest = async (requestId: string) => {
    if (!token) {
      toast({ variant: "destructive", title: "Session expired", description: "Please log in again to continue." });
      return;
    }

    try {
      await updateAccessRequest(token, requestId, { status: 'Denied' });
      toast({ title: `Request Denied`, description: `The request has been denied.` });
      void fetchRequests();
    } catch (error) {
      console.error(`Error denying request:`, error);
      toast({ variant: "destructive", title: "Action Failed", description: "Could not update the request status." });
    }
  };

  const handleConfirmApproval = async (requestId: string, validFrom: Date, expiresAt: Date | 'Permanent') => {
    if (!token) {
      toast({ variant: "destructive", title: "Session expired", description: "Please log in again to continue." });
      return;
    }

    try {
      const expiresAtValue = expiresAt === 'Permanent' ? 'Permanent' : expiresAt.toISOString().split('T')[0];
      await updateAccessRequest(token, requestId, {
        status: 'Approved',
        validFrom: validFrom.toISOString().split('T')[0],
        expiresAt: expiresAtValue,
        permanent: expiresAt === 'Permanent',
      });
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

  if (authLoading || !firestoreUser) {
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

    if (isSupervisor) {
      tabs.push({ value: "group-request", label: "Create Group Request" });
    }
    if (isManager) {
      tabs.push({ value: "approve", label: "Approve Requests" });
    }
    return tabs;
  };

  const visibleTabs = getVisibleTabs();

  return (
    <div className="space-y-4 md:space-y-5">
      <header className="flex flex-col gap-1 border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Access Request Workflow</h1>
        <p className="text-sm text-muted-foreground">Create, review, approve, and track governed access windows.</p>
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
          </TabsContent>
        )}

        {isSupervisor && (
          <TabsContent value="group-request">
            <SupervisorRequestForm
              supervisor={firestoreUser}
              operators={operators}
              sites={sites}
              contractors={contractors}
              isLoading={loading}
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
              onDeny={handleDenyRequest}
              onDelete={canDelete ? handleDeleteRequest : undefined}
              isLoading={loading}
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
    </div>
  );
}
