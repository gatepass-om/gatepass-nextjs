
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuthProtection } from '@/hooks/use-auth-protection';
import type { Operator, Contractor, User, Site, AccessRequest, ExternalCompanyType } from '@/lib/types';
import { OperatorsTable } from '@/components/companies/operators-table';
import { ContractorsTable } from '@/components/companies/contractors-table';
import { NewCompanyForm } from '@/components/companies/new-company-form';
import { Button } from '@/components/ui/button';
import { Building2, HardHat } from 'lucide-react';
import { useSession } from '@/providers/session-provider';
import {
  listOperatorsRequest,
  listExternalCompaniesRequest,
  listUsersRequest,
  listSitesRequest,
  listAccessRequestsRequest,
  createOperatorRequest,
  createExternalCompanyRequest,
  updateOperatorRequest,
  updateExternalCompanyRequest,
  deleteOperatorRequest,
  deleteExternalCompanyRequest,
  approveSubcontractorRequest,
  rejectSubcontractorRequest,
} from '@/lib/api';
import { usePolling } from '@/lib/polling';

export default function CompaniesPage() {
  const { currentUser, loading, isAuthorized, UnauthorizedComponent } = useAuthProtection(['Admin', 'Operator Admin', 'Contractor Admin', 'Supervisor']);
  const { token } = useSession();
  const [operators, setOperators] = useState<Operator[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isOperatorFormOpen, setIsOperatorFormOpen] = useState(false);
  const [isContractorFormOpen, setIsContractorFormOpen] = useState(false);
  const [showCompanyApprovals, setShowCompanyApprovals] = useState(false);
  const [submittedCompany, setSubmittedCompany] = useState('');

  const { toast } = useToast();
  const canManageCompanies = currentUser?.role === 'Admin' || currentUser?.role === 'Operator Admin';
  const canRegisterExternalCompany = currentUser?.role === 'Admin' || currentUser?.role === 'Operator Admin' || currentUser?.role === 'Contractor Admin';

  const fetchData = useCallback(async (options?: { silent?: boolean }) => {
    if (!token || !currentUser?.id) return;
    if (!options?.silent) setLoadingData(true);

    try {
      const [operatorsData, contractorsData, usersData, sitesData, requestData] = await Promise.allSettled([
        listOperatorsRequest(token),
        listExternalCompaniesRequest(token),
        listUsersRequest(token),
        currentUser.role === 'Contractor Admin' ? Promise.resolve([]) : listSitesRequest(token),
        listAccessRequestsRequest(token),
      ]);

      const failedSections: string[] = [];
      function applyLoaded<T>(result: PromiseSettledResult<T>, section: string, onLoaded: (value: T) => void) {
        if (result.status === 'fulfilled') onLoaded(result.value);
        else {
          failedSections.push(section);
          console.error(`Failed to load company ${section}`, result.reason);
        }
      }
      applyLoaded(operatorsData, 'operators', (data) => setOperators(data as Operator[]));
      applyLoaded(contractorsData, 'registrations', (data) => setContractors(data as Contractor[]));
      applyLoaded(usersData, 'personnel', (data) => setUsers(data as User[]));
      applyLoaded(sitesData, 'sites', (data) => setSites((data as any[]).map((site) => ({
        id: site.id,
        name: site.name,
        operatorId: site.operator?.id ?? site.operatorId ?? '',
        managerIds: site.managerIds ?? [],
        requiredCertificates: site.requiredCertificates ?? [],
      }))));
      applyLoaded(requestData, 'access requests', (data) => setRequests(data as AccessRequest[]));
      const message = failedSections.length ? `Could not load ${failedSections.join(', ')}. Successfully loaded company data remains available.` : '';
      setLoadError(message);
      if (message && !options?.silent) toast({ variant: 'destructive', title: 'Some company data is unavailable', description: message });
    } catch (error) {
      console.error('Failed to load companies data', error);
      setLoadError('Could not load company data. Please retry.');
      toast({ variant: "destructive", title: "Loading Failed", description: "Could not load company data." });
    } finally {
      if (!options?.silent) setLoadingData(false);
    }
  }, [token, currentUser?.id, currentUser?.role, toast]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  usePolling(() => {
    void fetchData({ silent: true });
  }, 20000);

  const handleAddCompany = async (input: { name: string; logoUrl?: string; type: 'operator' | 'contractor'; externalType?: ExternalCompanyType; operatorId?: string; contractNumber?: string; contractValidFromUtc?: string; contractValidToUtc?: string; adminName?: string; adminEmail?: string }): Promise<boolean> => {
    const { type } = input;
    const trimmed = input.name.trim();
    if (!token || !trimmed) return false;
    try {
      if (type === 'operator') {
        await createOperatorRequest(token, { name: trimmed });
      } else {
        await createExternalCompanyRequest(token, {
          name: trimmed,
          logoUrl: input.logoUrl,
          companyType: input.externalType ?? 1,
          operatorId: input.operatorId,
          contractNumber: input.contractNumber,
          contractValidFromUtc: input.contractValidFromUtc,
          contractValidToUtc: input.contractValidToUtc,
          adminName: input.adminName ?? '',
          adminEmail: input.adminEmail ?? '',
        });
      }
      const isRegistrationRequest = currentUser?.role === 'Contractor Admin' && type === 'contractor';
      toast({ title: isRegistrationRequest ? 'Registration request submitted' : `${type.charAt(0).toUpperCase() + type.slice(1)} Created`, description: isRegistrationRequest ? `"${trimmed}" is awaiting operator approval. The company and administrator remain inactive until approved.` : `Company "${trimmed}" has been added.` });
      if (isRegistrationRequest) { setShowCompanyApprovals(true); setSubmittedCompany(trimmed); }
      void fetchData();
      return true;
    } catch (error: any) {
      console.error(`Error adding ${type}:`, error);
      toast({ variant: "destructive", title: "Creation Failed", description: error.message || `Could not create the new ${type}.` });
      return false;
    }
  };

  const handleRenameOperator = async (operatorId: string, name: string, supervisorLimit?: number | null) => {
    const trimmed = name.trim();
    if (!token || !trimmed) return;
    try {
      await updateOperatorRequest(token, operatorId, { name: trimmed, supervisorLimit });
      toast({ title: "Operator Updated", description: "Operator name has been updated." });
      void fetchData();
    } catch (error: any) {
      console.error('Error renaming operator:', error);
      toast({ variant: "destructive", title: "Update Failed", description: error.message || "Could not update operator." });
    }
  };

  const handleRenameContractor = async (contractorId: string, name: string, companyType: ExternalCompanyType, logoUrl?: string, supervisorLimit?: number | null) => {
    const trimmed = name.trim();
    if (!token || !trimmed) return;
    try {
      await updateExternalCompanyRequest(token, contractorId, { name: trimmed, companyType, logoUrl, operatorId: currentUser?.operatorId ?? contractors.find((company) => company.id === contractorId)?.operatorId, supervisorLimit });
      toast({ title: "Contractor Updated", description: "Company details have been updated." });
      void fetchData();
    } catch (error: any) {
      console.error('Error renaming contractor:', error);
      toast({ variant: "destructive", title: "Update Failed", description: error.message || "Could not update contractor." });
    }
  };

  const handleDeleteOperator = async (operatorId: string, name: string) => {
    if (!token) return;
    try {
      await deleteOperatorRequest(token, operatorId);
      toast({ title: "Operator Deleted", description: `${name} has been removed.` });
      void fetchData();
    } catch (error: any) {
      console.error('Error deleting operator:', error);
      toast({ variant: "destructive", title: "Deletion Failed", description: error.message || "Could not delete operator." });
    }
  };

  const handleDeleteContractor = async (contractorId: string, name: string) => {
    if (!token) return;
    try {
      await deleteExternalCompanyRequest(token, contractorId);
      toast({ title: "Contractor Deleted", description: `${name} has been removed.` });
      void fetchData();
    } catch (error: any) {
      console.error('Error deleting contractor:', error);
      toast({ variant: "destructive", title: "Deletion Failed", description: error.message || "Could not delete contractor." });
    }
  };

  const handleSubcontractorDecision = async (contractorId: string, approve: boolean) => {
    if (!token) return;
    try {
      if (approve) await approveSubcontractorRequest(token, contractorId);
      else {
        const reason = window.prompt('Reason for rejecting this subcontractor registration:')?.trim();
        if (!reason) return;
        await rejectSubcontractorRequest(token, contractorId, reason);
      }
      toast({ title: approve ? 'Subcontractor approved' : 'Subcontractor rejected' });
      await fetchData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Decision failed', description: error.message ?? 'Could not update subcontractor status.' });
    }
  };

  if (loading || !currentUser) {
    return <div>Loading...</div>;
  }

  if (!isAuthorized) {
    return <UnauthorizedComponent />;
  }
  
  return (
    <div className="space-y-4 md:space-y-6">
       <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Company Management</h1>
          <p className="text-muted-foreground">
            {canManageCompanies
              ? 'Overview of operators and all connected contractor companies.'
              : 'Request subcontractor registration and track operator approval before company activation.'}
          </p>
        </div>
        {canRegisterExternalCompany && (
          <div className="flex flex-wrap items-center gap-2">
            {canManageCompanies && <Button variant="outline" onClick={() => setIsOperatorFormOpen(true)}>
              <Building2 className="mr-2 h-4 w-4" />
              New operator
            </Button>}
            <Button disabled={loadingData || (!currentUser.operatorId && operators.length === 0)} onClick={() => setIsContractorFormOpen(true)}>
              <HardHat className="mr-2 h-4 w-4" />
              {currentUser.role === 'Contractor Admin' ? 'Request subcontractor registration' : 'Register company'}
            </Button>
          </div>
        )}
      </header>
      {loadError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/30 p-4"><p className="text-sm">{loadError}</p><Button variant="outline" disabled={loadingData} onClick={() => void fetchData()}>Retry company data</Button></div>}
      {!loadingData && !loadError && canRegisterExternalCompany && !currentUser.operatorId && operators.length === 0 && <p role="status" className="rounded-md border p-4 text-sm">No approved operator is linked to your company. An operator must approve the company relationship before you can register a subcontractor.</p>}
      {submittedCompany && <div role="status" className="rounded-md border bg-muted/30 p-4"><p className="font-medium">Registration request submitted: {submittedCompany}</p><p className="mt-1 text-sm text-muted-foreground">Awaiting operator approval. The company and proposed administrator remain inactive. Track the decision in Registration requests.</p></div>}

      {canRegisterExternalCompany && (
        <>
          {canManageCompanies && <NewCompanyForm
            companyType="operator"
            onAddCompany={handleAddCompany}
            open={isOperatorFormOpen}
            onOpenChange={setIsOperatorFormOpen}
          />}
          <NewCompanyForm
            companyType="contractor"
            onAddCompany={handleAddCompany}
            open={isContractorFormOpen}
            onOpenChange={setIsContractorFormOpen}
            operators={operators}
            currentOperatorId={currentUser.operatorId ?? undefined}
            subcontractorRegistrationOnly={currentUser.role === 'Contractor Admin'}
          />
        </>
      )}

      <div className="space-y-6">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Company views"><Button variant={showCompanyApprovals ? 'outline' : 'default'} aria-pressed={!showCompanyApprovals} onClick={() => setShowCompanyApprovals(false)}>Company directory</Button><Button variant={showCompanyApprovals ? 'default' : 'outline'} aria-pressed={showCompanyApprovals} onClick={() => setShowCompanyApprovals(true)}>{canManageCompanies ? 'Company approvals' : 'Registration requests'} ({contractors.filter((company) => company.approvalStatus === 'PendingOperatorApproval').length} pending)</Button></div>
        {canManageCompanies && !showCompanyApprovals && (
	        <OperatorsTable
	            operators={operators}
	            users={users}
	            sites={sites}
	            isLoading={loadingData}
	            onRenameOperator={handleRenameOperator}
	            onDeleteOperator={handleDeleteOperator}
              canManage={canManageCompanies}
	        />
        )}
	        <ContractorsTable
              title={showCompanyApprovals ? (canManageCompanies ? 'Company approvals' : 'Registration requests') : 'External Companies'}
              description={showCompanyApprovals ? (canManageCompanies ? 'Review subcontractor registration requests. Approval activates the company and invites its administrator; rejection requires a reason.' : 'Track your subcontractor requests. Pending companies and their administrators remain inactive until the operator approves.') : undefined}
	            contractors={showCompanyApprovals ? contractors.filter((company) => company.approvalStatus === 'PendingOperatorApproval' || company.approvalStatus === 'Rejected') : contractors}
	            users={users}
	            accessRequests={requests}
	            isLoading={loadingData}
	            onRenameContractor={canManageCompanies ? handleRenameContractor : undefined}
	            onDeleteContractor={canManageCompanies ? handleDeleteContractor : undefined}
	            canDelete={currentUser?.role === 'Admin'}
              canManage={canManageCompanies}
              canDecideSubcontractors={currentUser?.role === 'Admin' || currentUser?.role === 'Operator Admin'}
              onApproveSubcontractor={(id) => void handleSubcontractorDecision(id, true)}
              onRejectSubcontractor={(id) => void handleSubcontractorDecision(id, false)}
	        />
      </div>
    </div>
  );
}
