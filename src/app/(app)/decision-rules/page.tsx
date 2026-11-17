'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Building2, CheckCircle2, Loader2, RotateCcw, Save, ShieldAlert, ShieldCheck, SlidersHorizontal, TestTube2, XCircle } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAuthProtection } from '@/hooks/use-auth-protection';
import { useSession } from '@/providers/session-provider';
import {
  evaluateAccessDecisionRequest,
  getAccessRulesRequest,
  listAccessRuleOptionsRequest,
  listSitesRequest,
  listTenantsRequest,
  listUsersRequest,
  updateAccessRulesRequest,
} from '@/lib/api';
import type { AccessDecisionEvaluation, AccessRuleConfig, DecisionReasonOption, Site, Tenant, User } from '@/lib/types';

function formatDate(value?: string | null) {
  if (!value) return 'Never';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function hasRelaxedRules(original: AccessRuleConfig | null, graceDays: number, toleratedReasons: number[]) {
  if (!original) return false;
  const originalReasons = new Set(original.toleratedReasons);
  return graceDays > original.certificateExpiryGraceDays
    || toleratedReasons.some((reason) => !originalReasons.has(reason));
}

export default function DecisionRulesPage() {
  const { currentUser, loading: authLoading, isAuthorized, UnauthorizedComponent } = useAuthProtection(['Admin']);
  const { token } = useSession();
  const { toast } = useToast();

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [config, setConfig] = useState<AccessRuleConfig | null>(null);
  const [reasonOptions, setReasonOptions] = useState<DecisionReasonOption[]>([]);
  const [graceDays, setGraceDays] = useState(0);
  const [toleratedReasons, setToleratedReasons] = useState<number[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [previewUserId, setPreviewUserId] = useState('');
  const [previewSiteId, setPreviewSiteId] = useState('');
  const [evaluation, setEvaluation] = useState<AccessDecisionEvaluation | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [confirmRelaxationOpen, setConfirmRelaxationOpen] = useState(false);

  const tolerableOptions = useMemo(
    () => reasonOptions.filter((option) => option.isTolerable),
    [reasonOptions]
  );
  const hardGuardOptions = useMemo(
    () => reasonOptions.filter((option) => option.isHardGuard),
    [reasonOptions]
  );
  const selectedTenant = tenants.find((tenant) => tenant.id === selectedTenantId);
  const filteredUsers = useMemo(
    () => users.filter((user) => !selectedTenantId || !user.tenantId || user.tenantId === selectedTenantId),
    [selectedTenantId, users]
  );
  const isDirty = Boolean(config)
    && (config!.certificateExpiryGraceDays !== graceDays
      || [...config!.toleratedReasons].sort().join(',') !== [...toleratedReasons].sort().join(','));

  const loadConfig = useCallback(async (tenantId: string) => {
    if (!token || !tenantId) return;
    const nextConfig = await getAccessRulesRequest(token, tenantId);
    setConfig(nextConfig);
    setGraceDays(nextConfig.certificateExpiryGraceDays);
    setToleratedReasons(nextConfig.toleratedReasons);
    setEvaluation(null);
  }, [token]);

  useEffect(() => {
    if (!token || !currentUser) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      listTenantsRequest(token, { includeInactive: false }),
      listAccessRuleOptionsRequest(token),
      listUsersRequest(token),
      listSitesRequest(token),
    ])
      .then(async ([tenantRows, options, userRows, siteRows]) => {
        if (cancelled) return;
        const tenantList = tenantRows.sort((a, b) => a.name.localeCompare(b.name));
        setTenants(tenantList);
        setReasonOptions(options);
        setUsers(userRows as User[]);
        setSites(siteRows as Site[]);
        const initialTenantId = tenantList[0]?.id ?? '';
        setSelectedTenantId(initialTenantId);
        if (initialTenantId) {
          await loadConfig(initialTenantId);
        }
      })
      .catch((error) => {
        console.error('Failed to load decision rules', error);
        toast({ variant: 'destructive', title: 'Load failed', description: error.message || 'Could not load decision rules.' });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentUser, loadConfig, toast, token]);

  const handleTenantChange = async (tenantId: string) => {
    setSelectedTenantId(tenantId);
    setLoading(true);
    try {
      await loadConfig(tenantId);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Load failed', description: error.message || 'Could not load access rules.' });
    } finally {
      setLoading(false);
    }
  };

  const handleReasonToggle = (reason: number, checked: boolean) => {
    setToleratedReasons((current) => {
      if (checked) return [...new Set([...current, reason])].sort((a, b) => a - b);
      return current.filter((value) => value !== reason);
    });
  };

  const persistRules = async () => {
    if (!token || !selectedTenantId) return;
    setSaving(true);
    try {
      const nextConfig = await updateAccessRulesRequest(token, selectedTenantId, {
        certificateExpiryGraceDays: graceDays,
        toleratedReasons,
      });
      setConfig(nextConfig);
      setGraceDays(nextConfig.certificateExpiryGraceDays);
      setToleratedReasons(nextConfig.toleratedReasons);
      setConfirmRelaxationOpen(false);
      toast({ title: 'Decision rules saved', description: 'The access decision engine will use the updated tenant rules.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Save failed', description: error.message || 'Could not save decision rules.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    if (hasRelaxedRules(config, graceDays, toleratedReasons)) {
      setConfirmRelaxationOpen(true);
      return;
    }
    void persistRules();
  };

  const handleReset = () => {
    if (!config) return;
    setGraceDays(config.certificateExpiryGraceDays);
    setToleratedReasons(config.toleratedReasons);
  };

  const handleEvaluate = async () => {
    if (!token || !selectedTenantId || !previewUserId || !previewSiteId) {
      toast({ variant: 'destructive', title: 'Selection required', description: 'Select a tenant, user, and site before evaluating.' });
      return;
    }
    setEvaluating(true);
    try {
      const result = await evaluateAccessDecisionRequest(token, selectedTenantId, {
        userId: previewUserId,
        siteId: previewSiteId,
      });
      setEvaluation(result);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Evaluation failed', description: error.message || 'Could not evaluate the decision.' });
    } finally {
      setEvaluating(false);
    }
  };

  if (authLoading || !currentUser) {
    return <div>Loading...</div>;
  }

  if (!isAuthorized) {
    return <UnauthorizedComponent />;
  }

  return (
    <div className="space-y-6">
      <header>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Decision Rules</h1>
          <p className="text-muted-foreground">Configure tenant-level access decision tolerances and test the effective outcome.</p>
        </div>
      </header>

      <Card>
        <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold">Apply changes to tenant</div>
              <p className="text-sm text-muted-foreground">
                Rules saved here apply to all sites and operators under the selected tenant. They are not currently scoped per individual operator.
              </p>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
            <Select value={selectedTenantId} onValueChange={handleTenantChange} disabled={loading || tenants.length === 0}>
              <SelectTrigger className="w-full sm:w-[320px]">
                <SelectValue placeholder="Select tenant to configure" />
              </SelectTrigger>
              <SelectContent>
                {tenants.map((tenant) => (
                  <SelectItem key={tenant.id} value={tenant.id}>{tenant.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="outline" className="h-9 justify-center px-3">
              {selectedTenant?.slug ?? 'No tenant'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Skeleton className="h-[420px]" />
          <Skeleton className="h-[420px]" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <SlidersHorizontal className="h-5 w-5" />
                      Access Rule Configuration
                    </CardTitle>
                    <CardDescription>Hard guards stay enforced. Only tenant-tolerable reasons can be relaxed.</CardDescription>
                  </div>
                  <Badge variant={isDirty ? 'default' : 'outline'}>{isDirty ? 'Unsaved changes' : 'Saved'}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-3 sm:max-w-sm">
                  <Label htmlFor="grace-days">Certificate expiry grace days</Label>
                  <Input
                    id="grace-days"
                    type="number"
                    min={0}
                    max={30}
                    value={graceDays}
                    onChange={(event) => setGraceDays(Math.max(0, Math.min(30, Number(event.target.value))))}
                  />
                  <p className="text-sm text-muted-foreground">Accepted range is 0-30 days. Missing certificates are still a hard block.</p>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div>
                    <h2 className="text-base font-semibold">Tenant-tolerable objections</h2>
                    <p className="text-sm text-muted-foreground">When selected, these specific objections are ignored by the access decision engine.</p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {tolerableOptions.map((option) => (
                      <label key={option.value} className="flex min-h-24 gap-3 rounded-md border bg-background p-4">
                        <Checkbox
                          checked={toleratedReasons.includes(option.value)}
                          onCheckedChange={(checked) => handleReasonToggle(option.value, checked === true)}
                          className="mt-1"
                        />
                        <span className="space-y-1">
                          <span className="block font-medium">{option.label}</span>
                          <span className="block text-sm text-muted-foreground">{option.description}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
                  <Button variant="outline" onClick={handleReset} disabled={!isDirty || saving}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reset
                  </Button>
                  <Button onClick={handleSave} disabled={!isDirty || saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save rules
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" />
                  Effective Enforcement
                </CardTitle>
                <CardDescription>Current rule behavior for {selectedTenant?.name ?? 'this tenant'}.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rule</TableHead>
                      <TableHead>Enforcement</TableHead>
                      <TableHead>Configurable</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(config?.effectiveRules ?? []).map((rule) => (
                      <TableRow key={rule.key}>
                        <TableCell>
                          <div className="font-medium">{rule.label}</div>
                          <div className="text-sm text-muted-foreground">{rule.description}</div>
                        </TableCell>
                        <TableCell>{rule.enforcement}</TableCell>
                        <TableCell>
                          <Badge variant={rule.tenantConfigurable ? 'default' : 'outline'}>
                            {rule.tenantConfigurable ? 'Limited' : 'No'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="mt-3 text-sm text-muted-foreground">Last updated: {formatDate(config?.updatedAtUtc)}</p>
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TestTube2 className="h-5 w-5" />
                  Test Decision
                </CardTitle>
                <CardDescription>Run the live access decision engine for a user and site.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>User</Label>
                  <Select value={previewUserId} onValueChange={setPreviewUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select user" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>{user.name} - {user.role}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Site</Label>
                  <Select value={previewSiteId} onValueChange={setPreviewSiteId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select site" />
                    </SelectTrigger>
                    <SelectContent>
                      {sites.map((site) => (
                        <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={handleEvaluate} disabled={evaluating || !previewUserId || !previewSiteId}>
                  {evaluating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TestTube2 className="mr-2 h-4 w-4" />}
                  Evaluate
                </Button>
                {evaluation && (
                  <div className={`rounded-md border p-4 ${evaluation.allowed ? 'border-green-200 bg-green-50 text-green-900' : 'border-red-200 bg-red-50 text-red-900'}`}>
                    <div className="flex items-center gap-2 font-semibold">
                      {evaluation.allowed ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                      {evaluation.allowed ? 'Allowed' : 'Denied'}
                    </div>
                    <div className="mt-2 text-sm">
                      {evaluation.message ?? (evaluation.allowed ? 'No rule objected.' : 'A rule blocked access.')}
                    </div>
                    {evaluation.reasonName && (
                      <Badge variant="outline" className="mt-3 bg-background">
                        {evaluation.reasonName}
                      </Badge>
                    )}
                    {evaluation.missingCertificates.length > 0 && (
                      <div className="mt-3 text-sm">
                        Missing: {evaluation.missingCertificates.join(', ')}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5" />
                  Hard Guards
                </CardTitle>
                <CardDescription>These reasons cannot be tolerated from tenant settings.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {hardGuardOptions.map((option) => (
                  <div key={option.value} className="rounded-md border p-3">
                    <div className="font-medium">{option.label}</div>
                    <div className="text-sm text-muted-foreground">{option.description}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </aside>
        </div>
      )}

      <AlertDialog open={confirmRelaxationOpen} onOpenChange={setConfirmRelaxationOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Confirm relaxed access rules
            </AlertDialogTitle>
            <AlertDialogDescription>
              This change makes the access decision engine more permissive for {selectedTenant?.name ?? 'the selected tenant'}.
              The change will be audited and used by gate scans, mobile access checks, and smart-lock access decisions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => {
              event.preventDefault();
              void persistRules();
            }} disabled={saving}>
              {saving ? 'Saving...' : 'Confirm and save'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
