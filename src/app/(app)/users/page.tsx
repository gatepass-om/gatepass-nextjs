"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { User, Site, Contractor, Operator, JobPosition } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { UsersTable } from "@/components/users/users-table";
import { BulkRegistration } from "@/components/users/bulk-registration";
import {
  canLoadPersonnelData,
  PERSONNEL_PAGE_ROLES,
  shouldLoadPersonnelSites,
} from "@/components/users/user-actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileUp } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthProtection } from "@/hooks/use-auth-protection";
import { useSession } from "@/providers/session-provider";
import { workspaceLandingForRole } from "@/lib/role-workspaces";
import {
  listUsersRequest,
  listSitesRequest,
  listContractorsRequest,
  listOperatorsRequest,
  createUserRequest,
  deleteUserRequest,
  listJobPositionsRequest,
  resendUserActivationRequest,
} from "@/lib/api";
import type { CreateUserInput } from "@/lib/api";

export default function UsersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    currentUser,
    loading: authLoading,
    isAuthorized,
    UnauthorizedComponent,
  } = useAuthProtection(PERSONNEL_PAGE_ROLES);
  const { token, startImpersonation } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [jobPositions, setJobPositions] = useState<JobPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBulkFormOpen, setIsBulkFormOpen] = useState(false);
  const { toast } = useToast();
  const createFromRequest = searchParams.get('new') === 'worker';
  const requestedReturnTo = searchParams.get('returnTo');
  const returnTo = requestedReturnTo?.startsWith('/') && !requestedReturnTo.startsWith('//')
    ? requestedReturnTo
    : null;

  const canCreateUser = useMemo(() => {
    return ["Admin", "Operator Admin", "Contractor Admin", "Manager", "Supervisor"].includes(
      currentUser?.role as string
    );
  }, [currentUser?.role]);
  const canMutateUsers = canCreateUser;

  const normalizeSite = useCallback((site: any): Site => {
    return {
      id: site.id,
      name: site.name,
      operatorId: site.operator?.id ?? site.operatorId ?? "",
      managerIds: site.managerIds ?? [],
      requiredCertificates: site.requiredCertificates ?? [],
    };
  }, []);

  const fetchData = useCallback(async () => {
    if (!token || !currentUser || !canLoadPersonnelData(currentUser.role)) {
      if (!authLoading) setLoading(false);
      return;
    }
    setLoading(true);

    try {
      const [sitesData, contractorsData, operatorsData, jobPositionData] = await Promise.all([
        shouldLoadPersonnelSites(currentUser.role)
          ? listSitesRequest(
              token,
              currentUser.role === "Operator Admin" && currentUser.operatorId
                ? { operatorId: currentUser.operatorId }
                : undefined
            )
          : Promise.resolve([]),
        currentUser.role === "Operator Admin" ? Promise.resolve([]) : listContractorsRequest(token),
        listOperatorsRequest(token),
        listJobPositionsRequest(token),
      ]);

      const mappedSites = (sitesData as any[]).map(normalizeSite);
      setSites(mappedSites);
      setContractors(contractorsData as Contractor[]);
      setOperators(operatorsData as Operator[]);
      setJobPositions(jobPositionData.filter((position) => position.isActive));

      let userFilters: { operatorId?: string; contractorId?: string } = {};
      if (currentUser.role === "Operator Admin") {
        if (currentUser.operatorId) {
          userFilters.operatorId = currentUser.operatorId;
        } else {
          setUsers([]);
          setLoading(false);
          return;
        }
      }
      if (currentUser.role === "Contractor Admin") {
        if (currentUser.contractorId) {
          userFilters.contractorId = currentUser.contractorId;
        } else {
          setUsers([]);
          setLoading(false);
          return;
        }
      }

      const usersData = await listUsersRequest(token, userFilters);
      setUsers(usersData as User[]);
    } catch (error) {
      console.error("Failed to load users data", error);
      toast({
        variant: "destructive",
        title: "Loading Failed",
        description: "Could not load users and supporting data.",
      });
    } finally {
      setLoading(false);
    }
  }, [token, currentUser, authLoading, normalizeSite, toast]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleAddUser = async (newUser: CreateUserInput): Promise<boolean> => {
    if (!token || !currentUser) {
      toast({
        variant: "destructive",
        title: "Session expired",
        description: "Please log in again to continue.",
      });
      return false;
    }

    let operatorId = newUser.operatorId;
    let contractorId = newUser.contractorId;

    if (currentUser.role === "Operator Admin" || currentUser.role === "Manager") {
      operatorId = currentUser.operatorId ?? undefined;
      contractorId = undefined;
    }
    if (currentUser.role === "Contractor Admin" || currentUser.role === "Supervisor") {
      contractorId = currentUser.contractorId ?? undefined;
    }

    try {
      const response = await createUserRequest(token, {
        ...newUser,
        operatorId: operatorId || undefined,
        contractorId: contractorId || undefined,
      });

      const createdUser = response.user;
      toast({
        title: "User Created",
        description: `${createdUser.name} has been created.`,
      });

      await fetchData();
      if (returnTo) router.push(returnTo);
      return true;
    } catch (error: any) {
      console.error("Error adding user: ", error);
      toast({
        variant: "destructive",
        title: "Creation Error",
        description: error.message || "Could not create user profile.",
      });
      return false;
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!token) {
      toast({
        variant: "destructive",
        title: "Session expired",
        description: "Please log in again to continue.",
      });
      return;
    }

    try {
      await deleteUserRequest(token, userId);
      setUsers((prev) => prev.filter((user) => user.id !== userId));
      toast({
        title: "User Deleted",
        description: `${userName} has been permanently removed.`,
      });
    } catch (error: any) {
      console.error("Error deleting user: ", error);
      toast({
        variant: "destructive",
        title: "Deletion Failed",
        description: error.message || `Could not delete ${userName}.`,
      });
    }
  };

  const handleResendActivation = async (user: User) => {
    if (!token) {
      toast({ variant: "destructive", title: "Session expired", description: "Please log in again to continue." });
      return;
    }

    try {
      await resendUserActivationRequest(token, user.id);
      toast({ title: "Activation link reissued", description: `A new activation link was sent to ${user.email}.` });
      await fetchData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Could not resend activation", description: error.message || "The activation link could not be reissued." });
    }
  };

  const handleImpersonateUser = async (user: User) => {
    try {
      const impersonated = await startImpersonation(user.id);
      toast({
        title: "Impersonation started",
        description: `You are now viewing GatePass as ${impersonated.name}.`,
      });
      router.push(workspaceLandingForRole(impersonated.role));
    } catch (error: any) {
      console.error("Error starting impersonation:", error);
      toast({
        variant: "destructive",
        title: "Impersonation failed",
        description: error.message || "Could not start impersonation.",
      });
    }
  };

  if (authLoading || !currentUser) {
    return <div>Loading...</div>;
  }

  if (!isAuthorized) {
    return <UnauthorizedComponent />;
  }

  return (
    <div className="min-w-0 space-y-4 md:space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Personnel</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Manage personnel from operators, contractors, and visitors.
          </p>
        </div>
        {canCreateUser && (
          <div className="flex w-full gap-2 sm:w-auto">
          <Dialog open={isBulkFormOpen} onOpenChange={setIsBulkFormOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto">
                <FileUp className="mr-2 h-4 w-4" />
                Import roster
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-full sm:max-w-2xl w-[95vw] sm:w-auto max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Import personnel roster</DialogTitle>
              </DialogHeader>
              {token && (
                <BulkRegistration
                  token={token}
                  onComplete={() => {
                    void fetchData();
                    setIsBulkFormOpen(false);
                  }}
                />
              )}
            </DialogContent>
          </Dialog>
          </div>
        )}
      </header>
      <UsersTable
        users={users}
        sites={sites}
        contractors={contractors}
        operators={operators}
        jobPositions={jobPositions}
        isLoading={loading}
        onDeleteUser={handleDeleteUser}
        currentUser={currentUser}
        canMutateUsers={canMutateUsers}
        onImpersonateUser={handleImpersonateUser}
        onResendActivation={handleResendActivation}
        onCreateUser={handleAddUser}
        startWithInlineRow={createFromRequest && canCreateUser}
      />
    </div>
  );
}
