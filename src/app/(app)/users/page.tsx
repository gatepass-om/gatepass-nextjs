"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { User, Site, Contractor, Operator, JobPosition } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { UsersTable } from "@/components/users/users-table";
import { AddPersonDialog } from "@/components/users/add-person-dialog";
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
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { matchesCredentialFilter, personnelStatus } from "@/components/users/personnel-status";
import { resolveUserCompanyName } from "@/components/users/user-company";
import { FileUp, UserPlus } from "lucide-react";
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
  const [isAddOpen, setIsAddOpen] = useState(searchParams.get('new') === 'worker');
  const [personnelSearch, setPersonnelSearch] = useState('');
  // Today's "Expiring soon" rows link here with the band they counted, so the list that opens is the
  // people behind the number rather than the whole register. One match or fifty, it is the same view.
  const [credentialFilter, setCredentialFilter] = useState(searchParams.get('credentialStatus') ?? 'all');
  const [withinDays, setWithinDays] = useState<number | null>(() => {
    const raw = Number(searchParams.get('within'));
    return Number.isFinite(raw) && raw > 0 ? raw : null;
  });
  const [roleFilter, setRoleFilter] = useState('all');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [accountFilter, setAccountFilter] = useState('all');
  const { toast } = useToast();
  const requestedReturnTo = searchParams.get('returnTo');
  const returnTo = requestedReturnTo?.startsWith('/') && !requestedReturnTo.startsWith('//')
    ? requestedReturnTo
    : null;
  const today = useMemo(() => new Date(), []);
  const displayedUsers = useMemo(() => {
    const term = personnelSearch.trim().toLowerCase();
    return users.filter((person) => {
      if (term && ![person.name, person.email, person.idNumber, person.nationality, person.employment?.jobPositionName]
        .some(value => value?.toLowerCase().includes(term))) return false;
      if (roleFilter !== 'all' && person.role !== roleFilter) return false;
      if (accountFilter !== 'all' && (person.status ?? '') !== accountFilter) return false;
      if (companyFilter !== 'all'
        && resolveUserCompanyName(person, contractors, operators) !== companyFilter) return false;
      if (credentialFilter !== 'all'
        && !matchesCredentialFilter(personnelStatus(person, today), credentialFilter, withinDays)) return false;
      return true;
    });
  }, [users, personnelSearch, roleFilter, accountFilter, companyFilter, credentialFilter, withinDays, contractors, operators, today]);

  const companyOptions = useMemo(() => {
    const names = new Set<string>();
    for (const person of users) {
      const name = resolveUserCompanyName(person, contractors, operators);
      if (name && name !== '—') names.add(name);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [users, contractors, operators]);

  const roleOptions = useMemo(
    () => [...new Set(users.map((person) => person.role))].sort((a, b) => a.localeCompare(b)),
    [users],
  );

  const filtersActive = roleFilter !== 'all' || companyFilter !== 'all' || accountFilter !== 'all'
    || credentialFilter !== 'all' || personnelSearch.trim() !== '';

  const clearFilters = () => {
    setPersonnelSearch('');
    setRoleFilter('all');
    setCompanyFilter('all');
    setAccountFilter('all');
    setCredentialFilter('all');
    setWithinDays(null);
  };

  const credentialSummary = credentialFilter === 'all'
    ? null
    : credentialFilter === 'Expired'
      ? 'with an expired document'
      : credentialFilter === 'Missing'
        ? 'with no documents on file'
        : withinDays
          ? `with a document expiring within ${withinDays} days`
          : 'with a document expiring soon';

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
      await fetchData();
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
        </div>
        {canCreateUser && (
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
          <Button className="w-full sm:w-auto" onClick={() => setIsAddOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add person
          </Button>
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
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full sm:max-w-md sm:flex-1"><Input value={personnelSearch} onChange={(event) => setPersonnelSearch(event.target.value)} placeholder="Search name, ID, email or position" className="w-full" /></div>
          <p className="text-sm text-muted-foreground">
            {displayedUsers.length === users.length
              ? `${users.length} personnel`
              : `${displayedUsers.length} of ${users.length} personnel`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={credentialFilter} onValueChange={(value) => { setCredentialFilter(value); if (value !== 'Expiring') setWithinDays(null); }}>
            <SelectTrigger className="h-9 w-auto min-w-[10rem]" aria-label="Document status"><SelectValue placeholder="Documents" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All documents</SelectItem>
              <SelectItem value="Expired">Expired</SelectItem>
              <SelectItem value="Expiring">Expiring soon</SelectItem>
              <SelectItem value="Missing">No documents</SelectItem>
              <SelectItem value="Valid">In order</SelectItem>
            </SelectContent>
          </Select>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="h-9 w-auto min-w-[9rem]" aria-label="Role"><SelectValue placeholder="Role" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {roleOptions.map((role) => <SelectItem key={role} value={role}>{role}</SelectItem>)}
            </SelectContent>
          </Select>
          {companyOptions.length > 1 ? (
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger className="h-9 w-auto min-w-[11rem] max-w-[16rem]" aria-label="Company"><SelectValue placeholder="Company" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All companies</SelectItem>
                {companyOptions.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : null}
          <Select value={accountFilter} onValueChange={setAccountFilter}>
            <SelectTrigger className="h-9 w-auto min-w-[9rem]" aria-label="Account status"><SelectValue placeholder="Account" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any account</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          {filtersActive ? (
            <Button variant="ghost" size="sm" onClick={clearFilters}>Clear filters</Button>
          ) : null}
        </div>
        {credentialSummary ? (
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-medium text-foreground">{displayedUsers.length}</span>{' '}
            {displayedUsers.length === 1 ? 'person' : 'people'} {credentialSummary}.
            {displayedUsers.length === 0 ? ' Nothing matches right now.' : ''}
          </p>
        ) : null}
      </div>
      <UsersTable
        users={displayedUsers}
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
      />
      {canCreateUser && (
        <AddPersonDialog
          open={isAddOpen}
          onOpenChange={setIsAddOpen}
          currentUser={currentUser}
          contractors={contractors}
          operators={operators}
          sites={sites}
          jobPositions={jobPositions}
          onCreateUser={handleAddUser}
        />
      )}
    </div>
  );
}
