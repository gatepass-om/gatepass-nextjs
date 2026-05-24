"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { User, Site, Contractor, Operator } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { UsersTable } from "@/components/users/users-table";
import { NewUserForm } from "@/components/users/new-user-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
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
} from "@/lib/api";

export default function UsersPage() {
  const {
    firestoreUser,
    loading: authLoading,
    isAuthorized,
    UnauthorizedComponent,
  } = useAuthProtection(["Admin", "Operator Admin", "Contractor Admin"]);
  const { token } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNewUserFormOpen, setIsNewUserFormOpen] = useState(false);
  const { toast } = useToast();

  const canCreateUser = useMemo(() => {
    return ["Admin", "Operator Admin", "Contractor Admin"].includes(
      firestoreUser?.role as string
    );
  }, [firestoreUser?.role]);

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
    if (!token || !firestoreUser) {
      if (!authLoading) setLoading(false);
      return;
    }
    setLoading(true);

    try {
      const [sitesData, contractorsData, operatorsData] = await Promise.all([
        listSitesRequest(
          token,
          firestoreUser.role === "Operator Admin" && firestoreUser.operatorId
            ? { operatorId: firestoreUser.operatorId }
            : undefined
        ),
        listContractorsRequest(token),
        listOperatorsRequest(token),
      ]);

      const mappedSites = (sitesData as any[]).map(normalizeSite);
      setSites(mappedSites);
      setContractors(contractorsData as Contractor[]);
      setOperators(operatorsData as Operator[]);

      let userFilters: { operatorId?: string; contractorId?: string } = {};
      if (firestoreUser.role === "Operator Admin") {
        if (firestoreUser.operatorId) {
          userFilters.operatorId = firestoreUser.operatorId;
        } else {
          setUsers([]);
          setLoading(false);
          return;
        }
      }
      if (firestoreUser.role === "Contractor Admin") {
        if (firestoreUser.contractorId) {
          userFilters.contractorId = firestoreUser.contractorId;
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
  }, [token, firestoreUser, authLoading, normalizeSite, toast]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleAddUser = async (
    newUser: Omit<
      User,
      "id" | "status" | "idCardImageUrl" | "idNumber" | "certificates" | "notes"
    >
  ) => {
    if (!token || !firestoreUser) {
      toast({
        variant: "destructive",
        title: "Session expired",
        description: "Please log in again to continue.",
      });
      return;
    }

    let operatorId = newUser.operatorId;
    let contractorId = newUser.contractorId;

    if (firestoreUser.role === "Operator Admin") {
      operatorId = firestoreUser.operatorId;
    }
    if (firestoreUser.role === "Contractor Admin") {
      contractorId = firestoreUser.contractorId;
    }

    try {
      const response = await createUserRequest(token, {
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        operatorId: operatorId || undefined,
        contractorId: contractorId || undefined,
        assignedSiteId: newUser.assignedSiteId ?? undefined,
        company: newUser.company ?? undefined,
      });

      const createdUser = response.user;
      setIsNewUserFormOpen(false);
      toast({
        title: "User Created",
        description: `${createdUser.name} has been created.`,
      });

      if (!response.emailSent && response.tempPassword) {
        toast({
          variant: "destructive",
          title: "Welcome Email Failed",
          description: `Share this temporary password manually: ${response.tempPassword}`,
          duration: 9000,
        });
      }

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

  if (authLoading || !firestoreUser) {
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
                currentUserRole={firestoreUser.role}
                currentUserId={firestoreUser.id}
                currentUserOperatorId={firestoreUser.operatorId ?? undefined}
                currentUserContractorId={firestoreUser.contractorId ?? undefined}
              />
            </DialogContent>
          </Dialog>
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
        currentUser={firestoreUser}
      />
    </div>
  );
}
