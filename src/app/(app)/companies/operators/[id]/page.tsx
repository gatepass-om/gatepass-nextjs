'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Building2, ClipboardList, HardHat, Loader2, MapPin, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuthProtection } from '@/hooks/use-auth-protection';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/providers/session-provider';
import { getOperatorDetailRequest } from '@/lib/api';
import type { OperatorDetail } from '@/lib/types';

function formatDate(value?: string | null) {
  if (!value) return 'Never';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'Approved') return 'default';
  if (status === 'Pending') return 'secondary';
  if (status === 'Denied') return 'destructive';
  return 'outline';
}

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Building2 }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="mt-1 text-2xl font-semibold">{value}</div>
        </div>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </CardContent>
    </Card>
  );
}

export default function OperatorDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { currentUser, loading: authLoading, isAuthorized, UnauthorizedComponent } = useAuthProtection(['Admin']);
  const { token } = useSession();
  const { toast } = useToast();
  const [detail, setDetail] = useState<OperatorDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDetail = useCallback(async () => {
    if (!token || !params.id) return;
    setLoading(true);
    try {
      setDetail(await getOperatorDetailRequest(token, params.id));
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Could not load operator', description: error.message || 'The operator details could not be loaded.' });
      router.push('/companies');
    } finally {
      setLoading(false);
    }
  }, [params.id, router, toast, token]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  if (authLoading || !currentUser) return <div>Loading...</div>;
  if (!isAuthorized) return <UnauthorizedComponent />;

  if (loading || !detail) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Button variant="ghost" className="-ml-3 mb-2" onClick={() => router.push('/companies')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Companies
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">{detail.name}</h1>
          <p className="text-muted-foreground">
            Operator details, sites, attached contractors, personnel, and recent access activity.
          </p>
        </div>
        <Badge variant="outline" className="w-fit">{detail.tenantName ?? detail.tenantId ?? 'No tenant'}</Badge>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Sites" value={detail.siteCount} icon={MapPin} />
        <StatCard label="Operator personnel" value={detail.userCount} icon={Users} />
        <StatCard label="Attached contractors" value={detail.contractorCount} icon={HardHat} />
        <StatCard label="Active requests" value={detail.activeRequestCount} icon={ClipboardList} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Attached Contractors</CardTitle>
          <CardDescription>Contractors with access requests linked to this operator.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contractor</TableHead>
                <TableHead>Personnel</TableHead>
                <TableHead>Sites</TableHead>
                <TableHead>Requests</TableHead>
                <TableHead>Last request</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.contractors.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="h-24 text-center">No contractors attached yet.</TableCell></TableRow>
              ) : detail.contractors.map((contractor) => (
                <TableRow key={contractor.id}>
                  <TableCell className="font-medium">
                    <Link className="hover:underline" href={`/companies/contractors/${contractor.id}`}>
                      {contractor.name}
                    </Link>
                  </TableCell>
                  <TableCell>{contractor.userCount}</TableCell>
                  <TableCell>{contractor.siteCount}</TableCell>
                  <TableCell>{contractor.requestCount} total, {contractor.activeRequestCount} active</TableCell>
                  <TableCell>{formatDate(contractor.lastRequestAtUtc)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sites</CardTitle>
            <CardDescription>Operator sites and operational counts.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Site</TableHead>
                  <TableHead>On site</TableHead>
                  <TableHead>Managers</TableHead>
                  <TableHead>Certificates</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.sites.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="h-24 text-center">No sites.</TableCell></TableRow>
                ) : detail.sites.map((site) => (
                  <TableRow key={site.id}>
                    <TableCell className="font-medium">{site.name}</TableCell>
                    <TableCell>{site.currentOnSiteCount}</TableCell>
                    <TableCell>{site.managerCount}</TableCell>
                    <TableCell>{site.requiredCertificateCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Operator Personnel</CardTitle>
            <CardDescription>Users directly assigned to this operator.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.personnel.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="h-24 text-center">No operator personnel.</TableCell></TableRow>
                ) : detail.personnel.map((person) => (
                  <TableRow key={person.id}>
                    <TableCell>
                      <div className="font-medium">{person.name}</div>
                      <div className="text-sm text-muted-foreground">{person.email}</div>
                    </TableCell>
                    <TableCell>{person.role}</TableCell>
                    <TableCell><Badge variant="outline">{person.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Site Access</CardTitle>
          <CardDescription>Latest requests involving this operator.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contractor</TableHead>
                <TableHead>Site</TableHead>
                <TableHead>Supervisor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Workers</TableHead>
                <TableHead>Requested</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.recentRequests.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-24 text-center">No access requests.</TableCell></TableRow>
              ) : detail.recentRequests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>{request.contractorName}</TableCell>
                  <TableCell>{request.siteName}</TableCell>
                  <TableCell>{request.supervisorName}</TableCell>
                  <TableCell><Badge variant={statusVariant(request.status)}>{request.status}</Badge></TableCell>
                  <TableCell>{request.workerCount}</TableCell>
                  <TableCell>{formatDate(request.requestedAtUtc)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
