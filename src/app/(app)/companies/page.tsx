
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuthProtection } from '@/hooks/use-auth-protection';
import type { Operator, Contractor, User, Site, AccessRequest } from '@/lib/types';
import { OperatorsTable } from '@/components/companies/operators-table';
import { ContractorsTable } from '@/components/companies/contractors-table';
import { NewCompanyForm } from '@/components/companies/new-company-form';
import { useSession } from '@/providers/session-provider';
import {
  listOperatorsRequest,
  listContractorsRequest,
  listUsersRequest,
  listSitesRequest,
  listAccessRequestsRequest,
  createOperatorRequest,
  createContractorRequest,
  updateOperatorRequest,
  updateContractorRequest,
  deleteOperatorRequest,
  deleteContractorRequest,
} from '@/lib/api';
import { usePolling } from '@/lib/polling';

export default function CompaniesPage() {
  const { firestoreUser, loading, isAuthorized, UnauthorizedComponent } = useAuthProtection(['Admin']);
  const { token } = useSession();
  const [operators, setOperators] = useState<Operator[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    if (!token || !firestoreUser?.id) return;
    setLoadingData(true);

    try {
      const [operatorsData, contractorsData, usersData, sitesData, requestData] = await Promise.all([
        listOperatorsRequest(token),
        listContractorsRequest(token),
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
  }, [token, firestoreUser?.id, toast]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  usePolling(() => {
    void fetchData();
  }, 20000);

  const handleAddCompany = async (name: string, type: 'operator' | 'contractor') => {
    const trimmed = name.trim();
    if (!token || !trimmed) return;
    try {
      if (type === 'operator') {
        await createOperatorRequest(token, { name: trimmed });
      } else {
        await createContractorRequest(token, { name: trimmed });
      }
      toast({ title: `${type.charAt(0).toUpperCase() + type.slice(1)} Created`, description: `Company "${trimmed}" has been added.` });
      void fetchData();
    } catch (error: any) {
      console.error(`Error adding ${type}:`, error);
      toast({ variant: "destructive", title: "Creation Failed", description: error.message || `Could not create the new ${type}.` });
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

  const handleRenameContractor = async (contractorId: string, name: string) => {
    const trimmed = name.trim();
    if (!token || !trimmed) return;
    try {
      await updateContractorRequest(token, contractorId, { name: trimmed });
      toast({ title: "Contractor Updated", description: "Contractor name has been updated." });
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
      await deleteContractorRequest(token, contractorId);
      toast({ title: "Contractor Deleted", description: `${name} has been removed.` });
      void fetchData();
    } catch (error: any) {
      console.error('Error deleting contractor:', error);
      toast({ variant: "destructive", title: "Deletion Failed", description: error.message || "Could not delete contractor." });
    }
  };

  if (loading || !firestoreUser) {
    return <div>Loading...</div>;
  }

  if (!isAuthorized) {
    return <UnauthorizedComponent />;
  }
  
  return (
    <div className="space-y-4 md:space-y-6">
       <header>
        <h1 className="text-3xl font-bold tracking-tight">Company Management</h1>
        <p className="text-muted-foreground">Overview of Operator and Contractor companies in the system.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <NewCompanyForm companyType="operator" onAddCompany={handleAddCompany} />
          <NewCompanyForm companyType="contractor" onAddCompany={handleAddCompany} />
      </div>

      <div className="space-y-6">
        <OperatorsTable
            operators={operators}
            users={users}
            sites={sites}
            isLoading={loadingData}
            onRenameOperator={handleRenameOperator}
            onDeleteOperator={handleDeleteOperator}
        />
        <ContractorsTable
            contractors={contractors}
            users={users}
            accessRequests={requests}
            isLoading={loadingData}
            onRenameContractor={handleRenameContractor}
            onDeleteContractor={handleDeleteContractor}
        />
      </div>
    </div>
  );
}
