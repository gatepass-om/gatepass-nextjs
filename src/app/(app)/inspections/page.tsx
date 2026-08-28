'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCheck, RefreshCw, UsersRound } from 'lucide-react';
import { format } from 'date-fns';
import { useAuthProtection } from '@/hooks/use-auth-protection';
import { useSession } from '@/providers/session-provider';
import { useToast } from '@/hooks/use-toast';
import { listSitesRequest } from '@/lib/api';
import { fetchInspectionAnalytics, type InspectionAnalytics } from '@/lib/inspections-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const InspectionCharts = dynamic(
  () => import('@/components/inspections/inspection-charts').then((module) => module.InspectionCharts),
  { ssr: false, loading: () => <Skeleton className="h-96 w-full" /> },
);

const EMPTY_ANALYTICS: InspectionAnalytics = {
  totalInspections: 0,
  uniqueWorkersInspected: 0,
  compliantInspections: 0,
  nonCompliantInspections: 0,
  complianceRate: 0,
  inspectors: [],
  commonWrongfulConductReasons: [],
  recentInspections: [],
};

type SiteOption = { id: string; name: string };

export default function InspectionsPage() {
  const { currentUser, loading: authLoading, isAuthorized, UnauthorizedComponent } = useAuthProtection([
    'Admin', 'Operator Admin', 'Manager', 'Supervisor', 'Security', 'Inspector',
  ]);
  const { token } = useSession();
  const { toast } = useToast();
  const [days, setDays] = useState('30');
  const [siteId, setSiteId] = useState('all');
  const [inspectorId, setInspectorId] = useState('all');
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [analytics, setAnalytics] = useState(EMPTY_ANALYTICS);
  const [loading, setLoading] = useState(true);

  const range = useMemo(() => {
    const to = new Date();
    const from = new Date(to);
    from.setUTCDate(from.getUTCDate() - Number(days));
    return { fromUtc: from.toISOString(), toUtc: to.toISOString() };
  }, [days]);

  const load = useCallback(async () => {
    if (!token || !currentUser) return;
    setLoading(true);
    try {
      const [siteRows, summary] = await Promise.all([
        listSitesRequest(token),
        fetchInspectionAnalytics(token, {
          ...range,
          siteId: siteId === 'all' ? undefined : siteId,
          inspectorUserId: inspectorId === 'all' ? undefined : inspectorId,
        }),
      ]);
      setSites((siteRows as Array<{ id: string; name: string }>).map(({ id, name }) => ({ id, name })));
      setAnalytics(summary);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Inspection analytics unavailable',
        description: error instanceof Error ? error.message : 'Could not load inspection analytics.',
      });
    } finally {
      setLoading(false);
    }
  }, [currentUser, inspectorId, range, siteId, toast, token]);

  useEffect(() => { void load(); }, [load]);

  if (authLoading || !currentUser) return <InspectionPageSkeleton />;
  if (!isAuthorized) return <UnauthorizedComponent />;

  const metrics = [
    { label: 'Inspections', value: analytics.totalInspections, icon: ClipboardCheck, detail: `Last ${days} days` },
    { label: 'Workers inspected', value: analytics.uniqueWorkersInspected, icon: UsersRound, detail: 'Distinct workers' },
    { label: 'Compliance rate', value: `${analytics.complianceRate.toFixed(1)}%`, icon: CheckCircle2, detail: `${analytics.compliantInspections} compliant` },
    { label: 'Wrongful conduct', value: analytics.nonCompliantInspections, icon: AlertTriangle, detail: 'Non-compliant findings' },
  ];

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inspection Analytics</h1>
          <p className="mt-1 text-muted-foreground">Workforce conduct, compliance outcomes, and inspector activity from mobile QR inspections.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-full sm:w-36"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="7">Last 7 days</SelectItem><SelectItem value="30">Last 30 days</SelectItem><SelectItem value="90">Last 90 days</SelectItem></SelectContent>
          </Select>
          <Select value={siteId} onValueChange={(value) => { setSiteId(value); setInspectorId('all'); }}>
            <SelectTrigger className="w-full sm:w-52"><SelectValue placeholder="All sites" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All sites</SelectItem>{sites.map((site) => <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={inspectorId} onValueChange={setInspectorId}>
            <SelectTrigger className="w-full sm:w-52"><SelectValue placeholder="All inspectors" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All inspectors</SelectItem>{analytics.inspectors.map((inspector) => <SelectItem key={inspector.inspectorUserId} value={inspector.inspectorUserId}>{inspector.inspectorName}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Inspection metrics">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{metric.label}</CardTitle>
              <metric.icon className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent><div className="text-3xl font-bold">{loading ? '—' : metric.value}</div><p className="mt-1 text-xs text-muted-foreground">{metric.detail}</p></CardContent>
          </Card>
        ))}
      </section>

      <InspectionCharts analytics={analytics} />

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.4fr]">
        <Card>
          <CardHeader><CardTitle>Inspector activity</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {analytics.inspectors.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No inspector activity in this period.</p> : analytics.inspectors.map((inspector) => (
              <button key={inspector.inspectorUserId} type="button" onClick={() => setInspectorId(inspector.inspectorUserId)} className="grid w-full grid-cols-[1fr_auto] gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/40">
                <span><span className="block font-medium">{inspector.inspectorName}</span><span className="text-xs text-muted-foreground">{inspector.uniqueWorkersInspected} workers inspected</span></span>
                <span className="text-right"><span className="block font-semibold">{inspector.totalInspections}</span><span className="text-xs text-muted-foreground">{inspector.complianceRate.toFixed(1)}% compliant</span></span>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent inspections</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Worker</TableHead><TableHead>Inspector</TableHead><TableHead>Site</TableHead><TableHead>Outcome</TableHead><TableHead>Reason</TableHead><TableHead>Time</TableHead></TableRow></TableHeader>
              <TableBody>
                {analytics.recentInspections.length === 0 ? <TableRow><TableCell colSpan={6} className="h-28 text-center text-muted-foreground">No inspections match the selected filters.</TableCell></TableRow> : analytics.recentInspections.map((inspection) => (
                  <TableRow key={inspection.id}>
                    <TableCell><span className="font-medium">{inspection.workerName}</span><span className="block text-xs text-muted-foreground">{inspection.workerCode ?? 'No worker code'}</span></TableCell>
                    <TableCell>{inspection.inspectorName}</TableCell><TableCell>{inspection.siteName}</TableCell>
                    <TableCell><Badge variant={inspection.outcome === 'Compliant' ? 'secondary' : 'destructive'}>{inspection.outcome === 'Compliant' ? 'Compliant' : 'Non-compliant'}</Badge></TableCell>
                    <TableCell className="max-w-56 truncate">{inspection.wrongfulConductReason ?? '—'}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{format(new Date(inspection.inspectedAtUtc), 'dd MMM, HH:mm')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function InspectionPageSkeleton() {
  return <div className="space-y-5"><Skeleton className="h-20 w-full" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-32" />)}</div><Skeleton className="h-96 w-full" /></div>;
}
