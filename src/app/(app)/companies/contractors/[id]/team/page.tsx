'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, MapPin, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuthProtection } from '@/hooks/use-auth-protection';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/providers/session-provider';
import { getContractorTeamRequest } from '@/lib/api';
import { summarizeTeam, teamMemberMatches } from '@/lib/contractor-team';
import type { ContractorTeam } from '@/lib/types';

function formatDate(value?: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}

/** Work-pass windows are whole UTC calendar days. */
function formatDay(value?: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value));
}

function splitWords(value?: string | null) {
  return (value ?? '').replace(/([a-z])([A-Z])/g, '$1 $2');
}

function clearanceVariant(status?: string | null): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'Cleared') return 'default';
  if (status === 'Pending') return 'secondary';
  if (status === 'Blocked' || status === 'Rejected' || status === 'Expired') return 'destructive';
  return 'outline';
}

export default function ContractorTeamPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { currentUser, loading: authLoading, isAuthorized, UnauthorizedComponent } = useAuthProtection(['Admin', 'Operator Admin', 'Contractor Admin', 'Manager']);
  const { token } = useSession();
  const { toast } = useToast();
  const [team, setTeam] = useState<ContractorTeam | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchTeam = useCallback(async () => {
    if (!token || !params.id) return;
    setLoading(true);
    try {
      setTeam(await getContractorTeamRequest(token, params.id));
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Could not load the team', description: error.message || 'The team could not be loaded.' });
      router.push(`/companies/contractors/${params.id}`);
    } finally {
      setLoading(false);
    }
  }, [params.id, router, toast, token]);

  useEffect(() => {
    void fetchTeam();
  }, [fetchTeam]);

  const members = useMemo(() => (team?.members ?? []).filter((member) => teamMemberMatches(member, search)), [team, search]);
  const summary = useMemo(() => summarizeTeam(team?.members ?? []), [team]);

  if (authLoading || !currentUser) return <div>Loading...</div>;
  if (!isAuthorized) return <UnauthorizedComponent />;

  if (loading || !team) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <Button variant="ghost" className="-ml-3 mb-2" onClick={() => router.push(`/companies/contractors/${team.contractorId}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {team.contractorName}
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Team and assignments</h1>
        <p className="text-muted-foreground">
          Everyone at {team.contractorName}, whether they are on site now, and the projects and work passes they are on.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'People', value: summary.people },
          { label: 'On site now', value: summary.onSite },
          { label: 'On a live work pass', value: summary.onWorkPass },
          { label: 'Not assigned', value: summary.unassigned },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="p-5">
              <div className="text-sm text-muted-foreground">{item.label}</div>
              <div className="mt-1 text-2xl font-semibold">{item.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>People</CardTitle>
            <CardDescription>Supervisors, workers and visitors registered under this company.</CardDescription>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search name, role, project or site" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Person</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Clearance</TableHead>
                <TableHead>Where now</TableHead>
                <TableHead>Assigned to</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="h-24 text-center">{search ? 'Nobody matches your search.' : 'No people registered yet.'}</TableCell></TableRow>
              ) : members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <Link className="font-medium hover:underline" href={`/users/${member.id}`}>{member.name}</Link>
                    <div className="text-sm text-muted-foreground">{member.jobTitle || member.email}</div>
                    {member.status !== 'Active' ? <Badge variant="outline" className="mt-1">{member.status}</Badge> : null}
                  </TableCell>
                  <TableCell>{member.role}</TableCell>
                  <TableCell>
                    {member.clearanceStatus ? <Badge variant={clearanceVariant(member.clearanceStatus)}>{member.clearanceStatus}</Badge> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    {member.onSite ? (
                      <span className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
                        <MapPin className="h-4 w-4" />
                        {member.currentSiteName ?? 'On site'}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Off site{member.lastSeenAtUtc ? `, last seen ${formatDate(member.lastSeenAtUtc)}` : ''}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {member.assignments.length === 0 ? (
                      <span className="text-muted-foreground">Not assigned</span>
                    ) : (
                      <ul className="space-y-1">
                        {member.assignments.map((assignment, index) => (
                          <li key={`${assignment.projectId}-${assignment.workPassNumber ?? assignment.capacity}-${index}`}>
                            <Link className="font-medium hover:underline" href={`/projects/${assignment.projectId}`}>{assignment.projectName}</Link>
                            <span className="text-sm text-muted-foreground">
                              {' · '}
                              {assignment.workPassNumber
                                ? `Work pass ${assignment.workPassNumber} (${splitWords(assignment.workPassStatus)})${assignment.siteName ? ` at ${assignment.siteName}` : ''}${assignment.validToUtc ? `, until ${formatDay(assignment.validToUtc)}` : ''}`
                                : assignment.capacity}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
