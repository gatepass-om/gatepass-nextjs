'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, BriefcaseBusiness, Building2, Loader2, Mail, MapPinned, ShieldCheck } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { EditUserForm } from '@/components/users/edit-user-form';
import {
  canEditUserRecord,
  canManageWorkerCard,
  canReviewWorkerCompliance,
  PERSONNEL_PAGE_ROLES,
  shouldLoadPersonnelSites,
  shouldShowWorkerDocuments,
} from '@/components/users/user-actions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useAuthProtection } from '@/hooks/use-auth-protection';
import { useToast } from '@/hooks/use-toast';
import {
  listCertificateTypesRequest,
  listContractorsRequest,
  listJobPositionsRequest,
  listOperatorsRequest,
  listSitesRequest,
  listUsersRequest,
  updateUserRequest,
  type UpdateUserInput,
} from '@/lib/api';
import type { CertificateType, Contractor, JobPosition, Operator, Site, User } from '@/lib/types';
import { resolveUserCompanyName } from '@/components/users/user-company';
import { useSession } from '@/providers/session-provider';
import { WorkerCards } from '@/components/workers/worker-cards';
import { WorkerDocuments } from '@/components/workers/worker-documents';
import { WorkerPositionCompliancePanel } from '@/components/compliance/worker-position-compliance';
import { WorkerTimeline } from '@/components/workers/worker-timeline';

export default function PersonnelProfilePage() {
  const params = useParams<{ id: string }>();
  const personnelId = params.id;
  const router = useRouter();
  const { toast } = useToast();
  const { token } = useSession();
  const { currentUser, loading: authLoading, isAuthorized, UnauthorizedComponent } = useAuthProtection(PERSONNEL_PAGE_ROLES);
  const [user, setUser] = useState<User | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [jobPositions, setJobPositions] = useState<JobPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [certificateTypes, setCertificateTypes] = useState<CertificateType[]>([]);

  const loadProfile = useCallback(async () => {
    if (!token || !currentUser || !personnelId) return;
    setLoading(true);

    try {
      if (
        (currentUser.role === 'Operator Admin' && !currentUser.operatorId)
        || (currentUser.role === 'Contractor Admin' && !currentUser.contractorId)
      ) {
        toast({ variant: 'destructive', title: 'Company assignment required', description: 'Your account must be assigned to a company before personnel can be viewed.' });
        router.push('/users');
        return;
      }

      const userFilters: { operatorId?: string; contractorId?: string } = {};
      if (currentUser.role === 'Operator Admin' && currentUser.operatorId) {
        userFilters.operatorId = currentUser.operatorId;
      }
      if (currentUser.role === 'Contractor Admin' && currentUser.contractorId) {
        userFilters.contractorId = currentUser.contractorId;
      }

      const [usersData, sitesData, contractorsData, operatorsData, positionsData] = await Promise.all([
        listUsersRequest(token, userFilters),
        shouldLoadPersonnelSites(currentUser.role)
          ? listSitesRequest(token, currentUser.role === 'Operator Admin' && currentUser.operatorId
            ? { operatorId: currentUser.operatorId }
            : undefined)
          : Promise.resolve([]),
        currentUser.role === 'Operator Admin' ? Promise.resolve([]) : listContractorsRequest(token),
        listOperatorsRequest(token),
        listJobPositionsRequest(token),
      ]);
      const selectedUser = usersData.find((person) => person.id === personnelId);

      if (!selectedUser) {
        toast({ variant: 'destructive', title: 'Personnel not found', description: 'This person is unavailable or outside your access scope.' });
        router.push('/users');
        return;
      }

      setUser(selectedUser);
      setSites((sitesData as any[]).map((site) => ({
        id: site.id,
        name: site.name,
        operatorId: site.operator?.id ?? site.operatorId ?? '',
        managerIds: site.managerIds ?? [],
        requiredCertificates: site.requiredCertificates ?? [],
      })));
      setContractors(contractorsData as Contractor[]);
      setOperators(operatorsData as Operator[]);
      setJobPositions(positionsData.filter((position) => position.isActive));
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Could not load profile', description: error.message || 'The personnel profile could not be loaded.' });
    } finally {
      setLoading(false);
    }
  }, [currentUser, personnelId, router, toast, token]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!token) return;
    void listCertificateTypesRequest(token)
      .then((types) => setCertificateTypes(types as CertificateType[]))
      .catch(() => setCertificateTypes([]));
  }, [token]);

  const handleUpdateUser = async (userId: string, originalUser: User, updatedData: UpdateUserInput) => {
    if (!token) return false;

    try {
      const updated = await updateUserRequest(token, userId, updatedData);
      setUser(updated);
      toast({ title: 'Profile updated', description: `${updated.name}'s profile has been saved.` });
      return true;
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Update failed', description: error.message || `Could not update ${originalUser.name}.` });
      return false;
    }
  };

  if (authLoading || !currentUser || loading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!isAuthorized) return <UnauthorizedComponent />;
  if (!user) return null;

  const companyName = resolveUserCompanyName(user, contractors, operators);
  const assignedSiteName = sites.find((site) => site.id === user.assignedSiteId)?.name;
  const canEdit = canEditUserRecord(['Admin', 'Operator Admin', 'Contractor Admin'].includes(currentUser.role), user.role);
  const showCompliance = shouldShowWorkerDocuments(user.role)
    && (canEdit || canReviewWorkerCompliance(currentUser.role, user.role));
  const showCard = canManageWorkerCard(currentUser.role, user.status);

  return (
    <div className="space-y-6">
      <header>
        <Button variant="ghost" className="-ml-3 mb-2" onClick={() => router.push('/users')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Personnel
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Personnel profile</h1>
        <p className="text-muted-foreground">Review identity and employment details, then update this profile below.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardContent className="flex flex-col items-center p-6 text-center">
            <Avatar className="h-28 w-28 border-4 border-background shadow-lg">
              <AvatarImage src={user.avatarUrl ?? undefined} alt={`${user.name}'s profile picture`} className="object-cover" />
              <AvatarFallback className="text-3xl font-semibold">
                {user.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <h2 className="mt-4 text-2xl font-semibold">{user.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{user.email || 'No email set'}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Badge>{user.role}</Badge>
              <Badge variant={user.status === 'Inactive' ? 'secondary' : 'outline'}>{user.status || 'Active'}</Badge>
            </div>
            <Separator className="my-6" />
            <dl className="w-full space-y-4 text-left text-sm">
              <div className="flex gap-3"><Mail className="mt-0.5 h-4 w-4 text-muted-foreground" /><div><dt className="text-muted-foreground">Email</dt><dd className="font-medium break-all">{user.email || 'Not provided'}</dd></div></div>
              <div className="flex gap-3"><ShieldCheck className="mt-0.5 h-4 w-4 text-muted-foreground" /><div><dt className="text-muted-foreground">National ID</dt><dd className="font-medium">{user.idNumber || 'Not provided'}</dd></div></div>
              <div className="flex gap-3"><Building2 className="mt-0.5 h-4 w-4 text-muted-foreground" /><div><dt className="text-muted-foreground">Company</dt><dd className="font-medium">{companyName}</dd></div></div>
              <div className="flex gap-3"><BriefcaseBusiness className="mt-0.5 h-4 w-4 text-muted-foreground" /><div><dt className="text-muted-foreground">Job position</dt><dd className="font-medium">{user.employment?.jobPositionName || 'Not assigned'}</dd></div></div>
              {['Security', 'Inspector'].includes(user.role) && (
                <div className="flex gap-3"><MapPinned className="mt-0.5 h-4 w-4 text-muted-foreground" /><div><dt className="text-muted-foreground">Assigned site</dt><dd className="font-medium">{assignedSiteName || 'Not assigned'}</dd></div></div>
              )}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{canEdit ? 'Edit personnel data' : 'Personnel data'}</CardTitle>
            <CardDescription>{canEdit ? 'Changes are saved directly to this personnel profile.' : 'You have read-only access to this profile.'}</CardDescription>
          </CardHeader>
          <CardContent>
            {canEdit ? (
              <EditUserForm
                user={user}
                currentUser={currentUser}
                onUpdateUser={handleUpdateUser}
                sites={sites}
                contractors={contractors}
                operators={operators}
                jobPositions={jobPositions}
                isLoading={loading}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Profile changes require personnel administration access.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {showCompliance && (
        <div className="space-y-6">
          <WorkerPositionCompliancePanel workerId={user.id} />
          <WorkerDocuments workerId={user.id} certificateTypes={certificateTypes} canManage={canEdit} />
          <WorkerTimeline workerId={user.id} />
        </div>
      )}

      {showCard && <WorkerCards workerId={user.id} />}
    </div>
  );
}
