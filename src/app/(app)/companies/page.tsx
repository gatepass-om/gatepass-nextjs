
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
} from '@/lib/api';
import { usePolling } from '@/lib/polling';

export default function CompaniesPage() {
  const { currentUser, loading, isAuthorized, UnauthorizedComponent } = useAuthProtection(['Admin', 'Operator Admin', 'Supervisor']);
  const { token } = useSession();
  const [operators, setOperators] = useState<Operator[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [isOperatorFormOpen, setIsOperatorFormOpen] = useState(false);
  const [isContractorFormOpen, setIsContractorFormOpen] = useState(false);

  const { toast } = useToast();
  const canManageCompanies = currentUser?.role === 'Admin';

  const fetchData = useCallback(async () => {
    if (!token || !currentUser?.id) return;
    setLoadingData(true);

    try {
      const [operatorsData, contractorsData, usersData, sitesData, requestData] = await Promise.all([
        listOperatorsRequest(token),
        listExternalCompaniesRequest(token),
        listUsersRequest(token),
        listSitesRequest(token),
        listAccessRequestsRequest(token),
      ]);

      setOperators(operatorsData as Operator[]);
      setContractors(contractorsData as Contractor[]);
      setUsers(usersData as User[]);
      setSites((sitesData as any[]).map((site) => ({
        id: site.id,
        name: site.name,
        operatorId: site.operator?.id ?? site.operatorId ?? '',
        managerIds: site.managerIds ?? [],
        requiredCertificates: site.requiredCertificates ?? [],
      })));
      setRequests(requestData as AccessRequest[]);
    } catch (error) {
      console.error('Failed to load companies data', error);
      toast({ variant: "destructive", title: "Loading Failed", description: "Could not load company data." });
    } finally {
      setLoadingData(false);
    }
  }, [token, currentUser?.id, toast]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  usePolling(() => {
    void fetchData();
  }, 20000);

  const handleAddCompany = async (name: string, type: 'operator' | 'contractor', externalType?: ExternalCompanyType): Promise<boolean> => {
    const trimmed = name.trim();
    if (!token || !trimmed) return false;
    try {
      if (type === 'operator') {
        await createOperatorRequest(token, { name: trimmed });
      } else {
        await createExternalCompanyRequest(token, { name: trimmed, companyType: externalType ?? 1 });
      }
      toast({ title: `${type.charAt(0).toUpperCase() + type.slice(1)} Created`, description: `Company "${trimmed}" has been added.` });
      void fetchData();
      return true;
    } catch (error: any) {
      console.error(`Error adding ${type}:`, error);
      toast({ variant: "destructive", title: "Creation Failed", description: error.message || `Could not create the new ${type}.` });
      return false;
    }
  };

  const handleRenameOperator = async (operatorId: string, name: string) => {
    const trimmed = name.trim();
    if (!token || !trimmed) return;
    try {
      await updateOperatorRequest(token, operatorId, { name: trimmed });
      toast({ title: "Operator Updated", description: "Operator name has been updated." });
      void fetchData();
    } catch (error: any) {
      console.error('Error renaming operator:', error);
      toast({ variant: "destructive", title: "Update Failed", description: error.message || "Could not update operator." });
    }
  };

  const handleRenameContractor = async (contractorId: string, name: string, companyType: ExternalCompanyType) => {
    const trimmed = name.trim();
    if (!token || !trimmed) return;
    try {
      await updateExternalCompanyRequest(token, contractorId, { name: trimmed, companyType });
      toast({ title: "External Company Updated", description: "Company details have been updated." });
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
      toast({ title: "External Company Deleted", description: `${name} has been removed.` });
      void fetchData();
    } catch (error: any) {
      console.error('Error deleting contractor:', error);
      toast({ variant: "destructive", title: "Deletion Failed", description: error.message || "Could not delete contractor." });
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
              ? 'Overview of operators and all connected external companies.'
              : 'External companies connected to your operator sites and access requests.'}
          </p>
        </div>
        {canManageCompanies && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => setIsOperatorFormOpen(true)}>
              <Building2 className="mr-2 h-4 w-4" />
              New operator
            </Button>
            <Button onClick={() => setIsContractorFormOpen(true)}>
              <HardHat className="mr-2 h-4 w-4" />
              New external company
            </Button>
          </div>
        )}
      </header>

      {canManageCompanies && (
        <>
          <NewCompanyForm
            companyType="operator"
            onAddCompany={handleAddCompany}
            open={isOperatorFormOpen}
            onOpenChange={setIsOperatorFormOpen}
          />
          <NewCompanyForm
            companyType="contractor"
            onAddCompany={handleAddCompany}
            open={isContractorFormOpen}
            onOpenChange={setIsContractorFormOpen}
          />
        </>
      )}

      <div className="space-y-6">
        {canManageCompanies && (
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
	            contractors={contractors}
	            users={users}
	            accessRequests={requests}
	            isLoading={loadingData}
	            onRenameContractor={canManageCompanies ? handleRenameContractor : undefined}
	            onDeleteContractor={canManageCompanies ? handleDeleteContractor : undefined}
              canManage={canManageCompanies}
	        />
      </div>
    </div>
  );
}
