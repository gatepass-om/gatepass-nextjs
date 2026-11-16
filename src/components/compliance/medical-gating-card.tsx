'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ShieldAlert } from 'lucide-react';

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  createDocumentRequirementRequest,
  deleteDocumentRequirementRequest,
  getMedicalGateRequest,
  listDocumentRequirementsRequest,
  listDocumentTypesRequest,
  setMedicalGateRequest,
  type DocumentRequirementRecord,
  type DocumentTypeInfo,
} from '@/lib/api';
import {
  DOCUMENT_CATEGORY_MEDICAL,
  ENFORCEMENT_BLOCKING,
  ENFORCEMENT_WARNING,
  SCOPE_TENANT,
  canConfigureMedicalGating,
  gatingModeOf,
  type GatingMode,
} from '@/lib/medical';
import { useSession } from '@/providers/session-provider';

const MODE_LABEL: Record<GatingMode, string> = {
  off: 'Not required',
  warning: 'Required — warning only',
  blocking: 'Required — refuse entry without it',
};

/**
 * Which medical records the whole company requires, and how strictly. Nothing medical is enforced until it is
 * switched on here, and an Unfit outcome only bars someone once a requirement names that kind of record, so this is
 * the control that decides whether fitness-to-work is real. Switching entry refusal on is confirmed first: from that
 * moment a worker with no verified, in-date record of that kind is turned away.
 */
export function MedicalGatingCard() {
  const { token, user } = useSession();
  const { toast } = useToast();
  const [types, setTypes] = useState<DocumentTypeInfo[]>([]);
  const [requirements, setRequirements] = useState<DocumentRequirementRecord[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ type: DocumentTypeInfo; mode: GatingMode } | null>(null);
  const [enforced, setEnforced] = useState<boolean | null>(null);
  const [confirmEnforce, setConfirmEnforce] = useState(false);

  const tenantId = user?.tenantId ?? null;

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [allTypes, rows, gate] = await Promise.all([
        listDocumentTypesRequest(token),
        listDocumentRequirementsRequest(token),
        getMedicalGateRequest(token),
      ]);
      setEnforced(gate.enforced);
      setTypes(allTypes.filter((type) => type.category === DOCUMENT_CATEGORY_MEDICAL && type.isActive));
      setRequirements(rows);
      setError('');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Medical requirements could not be loaded.');
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const companyRow = useCallback(
    (typeId: string) => requirements.find((row) =>
      row.documentTypeId === typeId && row.scopeKind === SCOPE_TENANT && row.scopeId === tenantId),
    [requirements, tenantId],
  );
  const otherScopes = useCallback(
    (typeId: string) => requirements.filter((row) =>
      row.documentTypeId === typeId && !(row.scopeKind === SCOPE_TENANT && row.scopeId === tenantId)).length,
    [requirements, tenantId],
  );

  const apply = async (type: DocumentTypeInfo, mode: GatingMode) => {
    if (!token || !tenantId) return;
    setBusy(true);
    try {
      const existing = companyRow(type.id);
      // There is no update: a change is the old rule removed and the new one made.
      if (existing) await deleteDocumentRequirementRequest(token, existing.id);
      if (mode !== 'off') {
        await createDocumentRequirementRequest(token, {
          documentTypeId: type.id,
          scopeKind: SCOPE_TENANT,
          scopeId: tenantId,
          enforcement: mode === 'blocking' ? ENFORCEMENT_BLOCKING : ENFORCEMENT_WARNING,
        });
      }
      toast({ title: `${type.name}: ${MODE_LABEL[mode].toLowerCase()}` });
      await load();
    } catch (failure) {
      toast({
        variant: 'destructive',
        title: 'Could not change the requirement',
        description: failure instanceof Error ? failure.message : 'Try again.',
      });
      await load();
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  const choose = (type: DocumentTypeInfo, mode: GatingMode) => {
    // Turning refusal on changes who gets through the gate today, so it is never a single click.
    if (mode === 'blocking') setPending({ type, mode });
    else void apply(type, mode);
  };

  // Turning enforcement on changes who gets through the gate, so it is confirmed. Turning it off never does.
  const toggleEnforced = async (next: boolean) => {
    if (!token) return;
    setBusy(true);
    try {
      const result = await setMedicalGateRequest(token, next);
      setEnforced(result.enforced);
      toast({ title: next ? 'Medical fitness is enforced at the gate' : 'Medical fitness is reported, not enforced' });
    } catch (failure) {
      toast({ variant: 'destructive', title: 'Could not change enforcement', description: failure instanceof Error ? failure.message : 'Try again.' });
    } finally {
      setBusy(false);
      setConfirmEnforce(false);
    }
  };

  const sorted = useMemo(() => [...types].sort((a, b) => a.name.localeCompare(b.name)), [types]);
  if (!canConfigureMedicalGating(user?.role)) return null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5" /> Medical fitness requirements</CardTitle>
          <CardDescription>
            Nothing medical is enforced until you switch it on. An unfit outcome only bars a worker once a requirement
            names that kind of record.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {error ? <p role="alert" className="text-sm text-danger-ink">{error}</p> : null}
          {enforced !== null ? (
            <label className="flex items-start justify-between gap-4 rounded-md border bg-muted/30 p-3">
              <span>
                <span className="block text-sm font-medium">Enforce medical fitness at the gate</span>
                <span className="block text-xs text-muted-foreground">
                  {enforced
                    ? 'On: an unfit outcome bars the worker, and a missing or expired record refuses entry.'
                    : 'Off: medical records are shown and reported as warnings. Nobody is refused for them.'}
                </span>
              </span>
              <Switch
                aria-label="Enforce medical fitness at the gate"
                checked={enforced}
                disabled={busy}
                onCheckedChange={(next) => (next ? setConfirmEnforce(true) : void toggleEnforced(false))}
              />
            </label>
          ) : null}
          {!tenantId ? (
            <p className="text-sm text-muted-foreground">Your account has no company set, so requirements cannot be managed from it.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {sorted.map((type) => {
                const mode = gatingModeOf(companyRow(type.id)?.enforcement);
                const elsewhere = otherScopes(type.id);
                return (
                  <li key={type.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{type.name}</p>
                      {elsewhere > 0 ? (
                        <p className="text-xs text-muted-foreground">Also required for {elsewhere} site, project or position rule{elsewhere === 1 ? '' : 's'}.</p>
                      ) : null}
                    </div>
                    <Select value={mode} disabled={busy} onValueChange={(value) => choose(type, value as GatingMode)}>
                      <SelectTrigger className="w-[17rem]" aria-label={`Requirement for ${type.name}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="off">{MODE_LABEL.off}</SelectItem>
                        <SelectItem value="warning">{MODE_LABEL.warning}</SelectItem>
                        <SelectItem value="blocking">{MODE_LABEL.blocking}</SelectItem>
                      </SelectContent>
                    </Select>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmEnforce} onOpenChange={(open) => { if (!open) setConfirmEnforce(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enforce medical fitness at the gate?</AlertDialogTitle>
            <AlertDialogDescription>
              From now, a worker whose medical record is unfit is barred, and a worker with a required record that is
              missing, pending or expired is refused entry. Workers who already hold a valid record are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={() => void toggleEnforced(true)}>Enforce it</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pending !== null} onOpenChange={(open) => { if (!open) setPending(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Refuse entry without {pending?.type.name.toLowerCase()}?</AlertDialogTitle>
            <AlertDialogDescription>
              From now, every worker in your company who has no verified, in-date record of this kind is turned away at
              the gate, and clearance cannot be given without one. An unfit outcome bars the worker outright. Workers who
              already hold a valid record are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={() => pending && void apply(pending.type, pending.mode)}>
              Refuse entry without it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
