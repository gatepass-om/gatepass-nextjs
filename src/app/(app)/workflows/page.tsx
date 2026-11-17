'use client';

import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';
import { useEffect, useState } from 'react';
import { GitBranch, Loader2 } from 'lucide-react';
import { WorkflowDesigner } from '@/components/workflows/workflow-designer';
import { WorkflowTaskInbox } from '@/components/workflows/workflow-task-inbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuthProtection } from '@/hooks/use-auth-protection';
import { useSession } from '@/providers/session-provider';
import { listTenantsRequest } from '@/lib/api';
import type { Tenant } from '@/lib/types';

export default function WorkflowsPage() {
  const { loading: authLoading, isAuthorized, UnauthorizedComponent } = useAuthProtection(['Admin']);
  const { token } = useSession();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantId, setTenantId] = useState('');
  const [loadingTenants, setLoadingTenants] = useState(true);

  useEffect(() => {
    if (!token || !isAuthorized) return;
    let cancelled = false;
    setLoadingTenants(true);
    void listTenantsRequest(token, { includeInactive: false })
      .then((rows) => {
        if (cancelled) return;
        const sorted = [...rows].sort((a, b) => a.name.localeCompare(b.name));
        setTenants(sorted);
        setTenantId(sorted[0]?.id ?? '');
      })
      .finally(() => {
        if (!cancelled) setLoadingTenants(false);
      });
    return () => { cancelled = true; };
  }, [isAuthorized, token]);

  if (authLoading) return <div className="grid min-h-64 place-items-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  if (!isAuthorized) return <UnauthorizedComponent />;
  if (!token) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl space-y-2">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-lg bg-primary text-primary-foreground"><GitBranch className="size-5" /></div>
            <h1 className="text-3xl font-semibold tracking-tight">Workflow Studio</h1>
          </div>
          <p className="text-muted-foreground">Design one approval flow per client. GatePass remains the system of record; Operaton runs the sequence and human-task state.</p>
        </div>
        <Badge variant="outline" className="w-fit">Admin only</Badge>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-semibold">Deployment client</div>
            <p className="text-sm text-muted-foreground">Each deployment is isolated with the client tenant ID.</p>
          </div>
          <Select value={tenantId} onValueChange={setTenantId} disabled={loadingTenants || tenants.length === 0}>
            <SelectTrigger className="w-full sm:w-[340px]"><SelectValue placeholder="Select a client" /></SelectTrigger>
            <SelectContent>{tenants.map((tenant) => <SelectItem key={tenant.id} value={tenant.id}>{tenant.name}</SelectItem>)}</SelectContent>
          </Select>
        </CardContent>
      </Card>

      <WorkflowDesigner token={token} tenantId={tenantId} />
      <WorkflowTaskInbox token={token} tenantId={tenantId} />
    </div>
  );
}
