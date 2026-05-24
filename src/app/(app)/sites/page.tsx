
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SitesTable } from "@/components/sites/sites-table";
import { NewSiteForm } from "@/components/sites/new-site-form";
import type { Site, User, CertificateType, Operator } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useAuthProtection } from '@/hooks/use-auth-protection';
import { useSession } from '@/providers/session-provider';
import {
  listSitesRequest,
  listUsersRequest,
  listCertificateTypesRequest,
  listOperatorsRequest,
  createSiteRequest,
  updateSiteRequest,
  deleteSiteRequest,
} from '@/lib/api';
import { usePolling } from '@/lib/polling';

export default function SitesPage() {
  const { firestoreUser, loading, isAuthorized, UnauthorizedComponent } = useAuthProtection(['Admin', 'Operator Admin']);
  const { token } = useSession();
  const [sites, setSites] = useState<Site[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [certificateTypes, setCertificateTypes] = useState<CertificateType[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingOperators, setLoadingOperators] = useState(true);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    if (!token || !firestoreUser) return;
    setLoadingData(true);
    try {
      const [sitesData, usersData, certsData] = await Promise.all([
        listSitesRequest(
          token,
          firestoreUser.role === 'Operator Admin' && firestoreUser.operatorId
            ? { operatorId: firestoreUser.operatorId }
            : undefined
        ),
        listUsersRequest(
          token,
          firestoreUser.role === 'Operator Admin' && firestoreUser.operatorId
            ? { operatorId: firestoreUser.operatorId }
            : undefined
        ),
        listCertificateTypesRequest(token),
      ]);

      setSites((sitesData as any[]).map((site) => ({
        id: site.id,
        name: site.name,
        operatorId: site.operator?.id ?? site.operatorId ?? '',
        managerIds: site.managerIds ?? [],
        requiredCertificates: site.requiredCertificates ?? [],
      })));
      setUsers(usersData as User[]);
      setCertificateTypes(certsData as CertificateType[]);
    } catch (error) {
      console.error('Failed to load site data', error);
      toast({ variant: "destructive", title: "Load Failed", description: "Could not load sites data." });
    } finally {
      setLoadingData(false);
    }
  }, [token, firestoreUser, toast]);

  const fetchOperators = useCallback(async () => {
    if (!token) return;
    setLoadingOperators(true);
    try {
      const operatorsData = await listOperatorsRequest(token);
      setOperators(operatorsData as Operator[]);
    } catch (error) {
      console.error('Failed to load operators', error);
      toast({ variant: "destructive", title: "Load Failed", description: "Could not load operators." });
    } finally {
      setLoadingOperators(false);
    }
  }, [token, toast]);

  useEffect(() => {
    void fetchData();
    if (firestoreUser?.role === 'Admin') {
      void fetchOperators();
    } else {
      setLoadingOperators(false);
    }
  }, [fetchData, fetchOperators, firestoreUser?.role]);

  usePolling(() => {
    void fetchData();
    if (firestoreUser?.role === 'Admin') {
      void fetchOperators();
    }
  }, 20000);

  const handleAddSite = async (newSite: Omit<Site, 'id'>) => {
    if (!token || !firestoreUser) {
      toast({ variant: "destructive", title: "Error", description: "Session expired." });
      return;
    }

    const trimmedName = newSite.name.trim();
    if (!trimmedName) {
      toast({ variant: "destructive", title: "Missing Name", description: "Please provide a site name." });
      return;
    }

    const operatorId = firestoreUser.role === 'Operator Admin'
      ? firestoreUser.operatorId
      : newSite.operatorId;

    if (!operatorId) {
      toast({ variant: "destructive", title: "Missing Operator", description: "Please select an operator for this site." });
      return;
    }

    const requiredCertificateIds = (newSite.requiredCertificates || [])
      .map((name) => certificateTypes.find((cert) => cert.name === name)?.id)
      .filter((id): id is string => Boolean(id));

    try {
      await createSiteRequest(token, {
        name: trimmedName,
        operatorId,
        managerIds: newSite.managerIds,
        requiredCertificateIds,
      });
      toast({ title: "Site Created", description: `The site "${trimmedName}" has been created.` });
      void fetchData();
    } catch (error: any) {
      console.error("Error adding site: ", error);
      toast({ variant: "destructive", title: "Creation Error", description: error.message || "Could not create the new site." });
    }
  };

  const handleUpdateSite = async (siteId: string, updatedData: Partial<Omit<Site, 'id'>>) => {
    if (!token) {
      toast({ variant: "destructive", title: "Error", description: "Database not available." });
      return false;
    }
    try {
      const trimmedName = updatedData.name ? updatedData.name.trim() : undefined;
      const requiredCertificateIds = updatedData.requiredCertificates
        ? updatedData.requiredCertificates
            .map((name) => certificateTypes.find((cert) => cert.name === name)?.id)
            .filter((id): id is string => Boolean(id))
        : undefined;

      await updateSiteRequest(token, siteId, {
        name: trimmedName || undefined,
        operatorId: updatedData.operatorId,
        managerIds: updatedData.managerIds,
        requiredCertificateIds,
      });
      toast({ title: "Site Updated", description: `The site has been updated.` });
      void fetchData();
      return true;
    } catch (error) {
      console.error("Error updating site:", error);
      toast({ variant: "destructive", title: "Update Error", description: "Could not update the site." });
      return false;
    }
  };

  const handleDeleteSite = async (siteId: string, siteName: string) => {
    if (!token) {
      toast({ variant: "destructive", title: "Error", description: "Session expired." });
      return;
    }
    try {
      await deleteSiteRequest(token, siteId);
      toast({ title: "Site Deleted", description: `${siteName} has been removed.` });
      void fetchData();
    } catch (error: any) {
      console.error("Error deleting site:", error);
      toast({ variant: "destructive", title: "Deletion Error", description: error.message || "Could not delete the site." });
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
        <h1 className="text-3xl font-bold tracking-tight">Site Management</h1>
        <p className="text-muted-foreground">Create, view, and manage all operational sites.</p>
      </header>
      <Tabs defaultValue="site-list">
        <TabsList className="grid w-full grid-cols-2 md:w-auto md:max-w-[400px]">
          <TabsTrigger value="site-list">Site List</TabsTrigger>
          <TabsTrigger value="new-site">New Site</TabsTrigger>
        </TabsList>
        <TabsContent value="site-list">
            <SitesTable 
              sites={sites} 
              users={users}
              certificateTypes={certificateTypes}
              operators={operators}
              isLoading={loadingData}
              isLoadingOperators={loadingOperators}
              currentUserRole={firestoreUser.role}
              onUpdateSite={handleUpdateSite}
              onDeleteSite={handleDeleteSite}
            />
        </TabsContent>
        <TabsContent value="new-site">
            <NewSiteForm 
              onNewSite={handleAddSite}
              users={users}
              certificateTypes={certificateTypes}
              operators={operators}
              isLoadingUsers={loadingData}
              isLoadingCerts={loadingData}
              isLoadingOperators={loadingOperators}
              currentUserRole={firestoreUser.role}
              currentUserOperatorId={firestoreUser.operatorId}
            />
        </TabsContent>
      </Tabs>
    </div>
  );
}
