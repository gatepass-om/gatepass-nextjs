"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { User, Site, Contractor, Operator } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { UsersTable } from "@/components/users/users-table";
import { NewUserForm } from "@/components/users/new-user-form";
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
import { FileUp, Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthProtection } from "@/hooks/use-auth-protection";
import { useSession } from "@/providers/session-provider";
import {
  listUsersRequest,
  listSitesRequest,
  listContractorsRequest,
  listOperatorsRequest,
  createUserRequest,
  updateUserRequest,
  deleteUserRequest,
  listRegistrationProfilesRequest,
  saveRegistrationValuesRequest,
} from "@/lib/api";
import type { CreateUserInput, RegistrationProfile } from "@/lib/api";

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
  const [registrationProfiles, setRegistrationProfiles] = useState<RegistrationProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNewUserFormOpen, setIsNewUserFormOpen] = useState(false);
  const [isBulkFormOpen, setIsBulkFormOpen] = useState(false);
  const { toast } = useToast();

  const canCreateUser = useMemo(() => {
    return ["Admin", "Operator Admin", "Contractor Admin"].includes(
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
      const [sitesData, contractorsData, operatorsData, workerProfiles, visitorProfiles] = await Promise.all([
        shouldLoadPersonnelSites(currentUser.role)
          ? listSitesRequest(
              token,
              currentUser.role === "Operator Admin" && currentUser.operatorId
                ? { operatorId: currentUser.operatorId }
                : undefined
            )
          : Promise.resolve([]),
        listContractorsRequest(token),
        listOperatorsRequest(token),
        listRegistrationProfilesRequest(token, "Worker"),
        listRegistrationProfilesRequest(token, "Visitor"),
      ]);

      const mappedSites = (sitesData as any[]).map(normalizeSite);
      setSites(mappedSites);
      setContractors(contractorsData as Contractor[]);
      setOperators(operatorsData as Operator[]);
      setRegistrationProfiles([...workerProfiles, ...visitorProfiles]);

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

  const handleAddUser = async (
    newUser: CreateUserInput,
    registration?: { profileId: string; entityType: string; values: Record<string, unknown> },
  ) => {
    if (!token || !currentUser) {
      toast({
        variant: "destructive",
        title: "Session expired",
        description: "Please log in again to continue.",
      });
      return;
    }

    let operatorId = newUser.operatorId;
    let contractorId = newUser.contractorId;

    if (currentUser.role === "Operator Admin") {
      operatorId = currentUser.operatorId ?? undefined;
    }
    if (currentUser.role === "Contractor Admin") {
      contractorId = currentUser.contractorId ?? undefined;
    }

    try {
      const response = await createUserRequest(token, {
        ...newUser,
        operatorId: operatorId || undefined,
        contractorId: contractorId || undefined,
      });

      const createdUser = response.user;
      if (registration) {
        try {
          await saveRegistrationValuesRequest(
            token,
            registration.entityType,
            createdUser.id,
            registration.profileId,
            registration.values,
          );
        } catch (registrationError) {
          console.error("Person created but registration details failed", registrationError);
          toast({
            variant: "destructive",
            title: "Person saved; checklist needs attention",
            description: "The personnel record was created, but the client-specific details were not saved. Edit the record and try again.",
          });
        }
      }
      setIsNewUserFormOpen(false);
      toast({
        title: "User Created",
        description: `${createdUser.name} has been created.`,
      });

      void fetchData();
    } catch (error: any) {
      console.error("Error adding user: ", error);
      toast({
        variant: "destructive",
        title: "Creation Error",
        description: error.message || "Could not create user profile.",
      });
    }
  };

  const handleUpdateUser = async (
    userId: string,
    originalUser: User,
    updatedData: Omit<User, "id">
  ) => {
    if (!token) {
      toast({
        variant: "destructive",
        title: "Session expired",
        description: "Please log in again to continue.",
      });
      return false;
    }

    try {
      const updated = await updateUserRequest(token, userId, updatedData);
      setUsers((prev) => prev.map((user) => (user.id === userId ? updated : user)));
      toast({
        title: "User Updated",
        description: `${updated.name}'s profile has been updated.`,
      });
      return true;
    } catch (error: any) {
      console.error("Error updating user:", error);
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message || "Could not update user.",
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

  const handleImpersonateUser = async (user: User) => {
    try {
      const impersonated = await startImpersonation(user.id);
      toast({
        title: "Impersonation started",
        description: `You are now viewing GatePass as ${impersonated.name}.`,
      });
      router.push(impersonated.role === "Worker" || impersonated.role === "Visitor"
        ? "/profile"
        : impersonated.role === "Contractor Admin"
          ? "/access-requests"
          : "/dashboard");
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
    <div className="space-y-4 md:space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Personnel Management</h1>
          <p className="text-muted-foreground">
            Manage personnel from operators, contractors, and visitors.
          </p>
        </div>
        {canCreateUser && (
          <div className="flex gap-2">
          <Dialog open={isBulkFormOpen} onOpenChange={setIsBulkFormOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
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
          <Dialog open={isNewUserFormOpen} onOpenChange={setIsNewUserFormOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create User
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-full sm:max-w-2xl w-[95vw] sm:w-auto max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New User Profile</DialogTitle>
              </DialogHeader>
              <NewUserForm
                onNewUser={handleAddUser}
                sites={sites}
                contractors={contractors}
                operators={operators}
                isLoading={loading}
                currentUserRole={currentUser.role}
                currentUserId={currentUser.id}
                currentUserOperatorId={currentUser.operatorId ?? undefined}
                currentUserContractorId={currentUser.contractorId ?? undefined}
                registrationProfiles={registrationProfiles}
              />
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
        isLoading={loading}
        onDeleteUser={handleDeleteUser}
        onUpdateUser={handleUpdateUser}
        currentUser={currentUser}
        canMutateUsers={canMutateUsers}
        onImpersonateUser={handleImpersonateUser}
      />
    </div>
  );
}
