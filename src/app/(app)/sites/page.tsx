
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { SitesTable } from "@/components/sites/sites-table";
import { NewSiteForm } from "@/components/sites/new-site-form";
import type { Site, User, CertificateType, Operator } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useAuthProtection } from '@/hooks/use-auth-protection';
import { useSession } from '@/providers/session-provider';
import {
  listSitesPageRequest,
  listUsersRequest,
  listCertificateTypesRequest,
  listOperatorsRequest,
  createSiteRequest,
  updateSiteRequest,
  deleteSiteRequest,
} from '@/lib/api';
import { usePolling } from '@/lib/polling';
import { PaginationControls } from '@/components/ui/pagination-controls';

const SITE_PAGE_SIZE = 20;

export default function SitesPage() {
  const { currentUser, loading, isAuthorized, UnauthorizedComponent } = useAuthProtection(['Admin', 'Operator Admin']);
  const { token } = useSession();
  const [sites, setSites] = useState<Site[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [certificateTypes, setCertificateTypes] = useState<CertificateType[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [sitePage, setSitePage] = useState(1);
  const [siteTotalPages, setSiteTotalPages] = useState(0);
  const [hasPreviousSitePage, setHasPreviousSitePage] = useState(false);
  const [hasNextSitePage, setHasNextSitePage] = useState(false);
  const [loadingOperators, setLoadingOperators] = useState(true);
  const [isNewSiteFormOpen, setIsNewSiteFormOpen] = useState(false);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    if (!token || !currentUser) return;
    setLoadingData(true);
    try {
      const [sitesData, usersData, certsData] = await Promise.all([
        listSitesPageRequest(
          token,
          currentUser.role === 'Operator Admin' && currentUser.operatorId
            ? { operatorId: currentUser.operatorId, page: sitePage, pageSize: SITE_PAGE_SIZE }
            : { page: sitePage, pageSize: SITE_PAGE_SIZE }
        ),
        listUsersRequest(
          token,
          currentUser.role === 'Operator Admin' && currentUser.operatorId
            ? { operatorId: currentUser.operatorId }
            : undefined
        ),
        listCertificateTypesRequest(token),
      ]);

      setSites(sitesData.items.map((site) => ({
        id: site.id,
        name: site.name,
        operatorId: site.operator?.id ?? site.operatorId ?? '',
        managerIds: site.managerIds ?? [],
        requiredCertificates: site.requiredCertificates ?? [],
        requiresAccessApproval: site.requiresAccessApproval ?? true,
        usesSecurityCheckpoints: site.usesSecurityCheckpoints ?? true,
        usesSmartAccess: site.usesSmartAccess ?? true,
        maximumOccupancy: site.maximumOccupancy ?? undefined,
      })));
      setSiteTotalPages(sitesData.totalPages);
      setHasPreviousSitePage(sitesData.hasPreviousPage);
      setHasNextSitePage(sitesData.hasNextPage);
      setUsers(usersData as User[]);
      setCertificateTypes(certsData as CertificateType[]);
    } catch (error) {
      console.error('Failed to load site data', error);
      toast({ variant: "destructive", title: "Load Failed", description: "Could not load sites data." });
    } finally {
      setLoadingData(false);
    }
  }, [token, currentUser, sitePage, toast]);

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
    if (currentUser?.role === 'Admin') {
      void fetchOperators();
    } else {
      setLoadingOperators(false);
    }
  }, [fetchData, fetchOperators, currentUser?.role]);

  usePolling(() => {
    void fetchData();
    if (currentUser?.role === 'Admin') {
      void fetchOperators();
    }
  }, 20000);

  const handleAddSite = async (newSite: Omit<Site, 'id'>): Promise<boolean> => {
    if (!token || !currentUser) {
      toast({ variant: "destructive", title: "Error", description: "Session expired." });
      return false;
    }

    const trimmedName = newSite.name.trim();
    if (!trimmedName) {
      toast({ variant: "destructive", title: "Missing Name", description: "Please provide a site name." });
      return false;
    }

    const operatorId = currentUser.role === 'Operator Admin'
      ? currentUser.operatorId
      : newSite.operatorId;

    if (!operatorId) {
      toast({ variant: "destructive", title: "Missing Operator", description: "Please select an operator for this site." });
      return false;
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
        requiresAccessApproval: newSite.requiresAccessApproval ?? false,
        usesSecurityCheckpoints: newSite.usesSecurityCheckpoints ?? false,
        usesSmartAccess: newSite.usesSmartAccess ?? false,
        maximumOccupancy: newSite.maximumOccupancy,
      });
      toast({ title: "Site Created", description: `The site "${trimmedName}" has been created.` });
      void fetchData();
      return true;
    } catch (error: any) {
      console.error("Error adding site: ", error);
      toast({ variant: "destructive", title: "Creation Error", description: error.message || "Could not create the new site." });
      return false;
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
        requiresAccessApproval: updatedData.requiresAccessApproval,
        usesSecurityCheckpoints: updatedData.usesSecurityCheckpoints,
        usesSmartAccess: updatedData.usesSmartAccess,
        maximumOccupancy: updatedData.maximumOccupancy,
        clearMaximumOccupancy:
          updatedData.maximumOccupancy === undefined
          && sites.find((site) => site.id === siteId)?.maximumOccupancy !== undefined,
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

  if (loading || !currentUser) {
    return <div>Loading...</div>;
  }

  if (!isAuthorized) {
    return <UnauthorizedComponent />;
  }
  
  return (
    <div className="space-y-4 md:space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Site Management</h1>
          <p className="text-muted-foreground">Create, view, and manage all operational sites.</p>
        </div>
        <Dialog open={isNewSiteFormOpen} onOpenChange={setIsNewSiteFormOpen}>
          <Button onClick={() => setIsNewSiteFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add site
          </Button>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create a New Site</DialogTitle>
              <DialogDescription>Enter the site details below.</DialogDescription>
            </DialogHeader>
            <NewSiteForm
              onNewSite={handleAddSite}
              users={users}
              certificateTypes={certificateTypes}
              operators={operators}
              isLoadingUsers={loadingData}
              isLoadingCerts={loadingData}
              isLoadingOperators={loadingOperators}
              currentUserRole={currentUser.role}
              currentUserOperatorId={currentUser.operatorId}
              closeDialog={() => setIsNewSiteFormOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </header>
      <SitesTable
        sites={sites}
        users={users}
        certificateTypes={certificateTypes}
        operators={operators}
        isLoading={loadingData}
        isLoadingOperators={loadingOperators}
        currentUserRole={currentUser.role}
        onUpdateSite={handleUpdateSite}
        onDeleteSite={handleDeleteSite}
      />
      <PaginationControls
        noun="sites"
        page={sitePage}
        totalPages={siteTotalPages}
        hasPreviousPage={hasPreviousSitePage}
        hasNextPage={hasNextSitePage}
        onPageChange={setSitePage}
      />
    </div>
  );
}
