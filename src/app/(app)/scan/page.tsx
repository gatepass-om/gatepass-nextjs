'use client'

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Building2, Camera, RadioTower } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import type { User as UserType, Site, ScanAccessRequest } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthProtection } from '@/hooks/use-auth-protection';
import { ScannerPreview } from '@/components/scan/scanner-preview';
import { UserFoundDialog } from '@/components/scan/user-found-dialog';
import { VisitorRegistrationDialog } from '@/components/scan/visitor-registration-dialog';
import { useSession } from '@/providers/session-provider';
import { fetchScanStatusRequest, fetchScanByTokenRequest, listSitesRequest, fetchWorkerRequest } from '@/lib/api';
import { usePolling } from '@/lib/polling';
import { ScanDecisionPanel } from '@/components/scan/scan-decision-panel';
import { Badge } from '@/components/ui/badge';

type DialogState = 'closed' | 'user-found' | 'no-user' | 'visitor-register';
type LastActivity = 'CheckIn' | 'CheckOut' | null;
type AccessEnforcementMode = 'None' | 'SecurityScan' | 'MobileSmartLock' | 'Hybrid';
type CertificateStatus = {
  missing: string[];
  expired: string[];
};

type WorkerData = {
  jobTitle?: string;
};

type ScanStatusResponse = {
  user: UserType;
  site: {
    id: string;
    name: string;
    requiredCertificates: string[];
  };
  certificateStatus: CertificateStatus;
  accessStatus: 'approved' | 'denied-no-request' | 'denied-expired' | 'denied-not-started';
  accessRequest: ScanAccessRequest | null;
  lastActivity: LastActivity;
  smartLockEnforced?: boolean;
  scanRequired?: boolean;
  accessEnforcementMode?: AccessEnforcementMode;
  accessEnforcementMessage?: string | null;
  mobileAppCheckInRequired?: boolean;
  canCheckIn?: boolean;
  canCheckOut?: boolean;
};

export default function ScanPage() {
  const { currentUser: currentSecurityUser, loading: authLoading, isAuthorized, UnauthorizedComponent } = useAuthProtection(['Security', 'Inspector', 'Admin']);
  const { token } = useSession();
  const [scannedUser, setScannedUser] = useState<UserType | null>(null);
  const [assignedSite, setAssignedSite] = useState<Site | null>(null);
  const [loadingSite, setLoadingSite] = useState(true);
  const [dialogState, setDialogState] = useState<DialogState>('closed');
  const [accessStatus, setAccessStatus] = useState<'approved' | 'denied-no-request' | 'denied-expired' | 'denied-not-started' | null>(null);
  const [certificateStatus, setCertificateStatus] = useState<CertificateStatus>({ missing: [], expired: [] });
  const [lastActivity, setLastActivity] = useState<LastActivity>(null);
  const [isScannerPaused, setIsScannerPaused] = useState(false);
  const [accessRequest, setAccessRequest] = useState<ScanAccessRequest | null>(null);
  const [workerData, setWorkerData] = useState<WorkerData | undefined>();
  const [smartLockEnforced, setSmartLockEnforced] = useState(false);
  const [scanRequired, setScanRequired] = useState(true);
  const [accessEnforcementMode, setAccessEnforcementMode] = useState<AccessEnforcementMode>('SecurityScan');
  const [accessEnforcementMessage, setAccessEnforcementMessage] = useState<string | null>(null);

  const { toast } = useToast();

  const normalizeSite = useCallback((site: any): Site => {
    return {
      id: site.id,
      name: site.name,
      operatorId: site.operator?.id ?? site.operatorId ?? '',
      managerIds: site.managerIds ?? [],
      requiredCertificates: site.requiredCertificates ?? [],
      requiresAccessApproval: site.requiresAccessApproval ?? true,
      usesSecurityCheckpoints: site.usesSecurityCheckpoints ?? true,
      usesSmartAccess: site.usesSmartAccess ?? true,
    };
  }, []);

  const fetchAssignedSite = useCallback(async () => {
    if (!token || !currentSecurityUser?.assignedSiteId) {
      setAssignedSite(null);
      setLoadingSite(false);
      return;
    }

    setLoadingSite(true);
    try {
      const sitesData = await listSitesRequest(token);
      const mappedSites = sitesData.map(normalizeSite);
      const site = mappedSites.find((item) => item.id === currentSecurityUser.assignedSiteId) ?? null;
      if (!site) {
        setAssignedSite(null);
        toast({ variant: 'destructive', title: 'Site Error', description: 'Assigned site not found.' });
      } else {
        setAssignedSite(site);
      }
    } catch (error) {
      console.error('Failed to fetch assigned site', error);
      toast({ variant: 'destructive', title: 'Site Error', description: 'Could not load assigned site details.' });
      setAssignedSite(null);
    } finally {
      setLoadingSite(false);
    }
  }, [token, currentSecurityUser?.assignedSiteId, normalizeSite, toast]);

  useEffect(() => {
    void fetchAssignedSite();
  }, [fetchAssignedSite]);

  usePolling(() => {
    void fetchAssignedSite();
  }, 30000);

  const refreshScanStatus = useCallback(async () => {
    if (!token || !assignedSite || !scannedUser) return;
    try {
      const status = await fetchScanStatusRequest(token, scannedUser.id, assignedSite.id);
      setAccessStatus(status.accessStatus);
      setCertificateStatus(status.certificateStatus);
      setAccessRequest(status.accessRequest);
      setLastActivity(status.lastActivity ?? null);
      setSmartLockEnforced(Boolean(status.smartLockEnforced));
      setScanRequired(status.scanRequired !== false);
      setAccessEnforcementMode(status.accessEnforcementMode ?? 'SecurityScan');
      setAccessEnforcementMessage(status.accessEnforcementMessage ?? null);
      setAssignedSite((prev) => {
        if (!prev || prev.id !== status.site.id) return prev;
        return {
          ...prev,
          name: status.site.name,
          requiredCertificates: status.site.requiredCertificates,
        };
      });
    } catch (error) {
      console.error('Failed to refresh scan status', error);
    }
  }, [token, assignedSite, scannedUser]);

  usePolling(() => {
    if (dialogState === 'user-found') {
      void refreshScanStatus();
    }
  }, 15000);

  const handleScanSuccess = async (scannedValue: string) => {
    if (!token || !assignedSite) return;
    setIsScannerPaused(true);

    try {
      // A live QR credential is a signed JWT (header.payload.signature); a legacy/static badge encodes the raw
      // worker id. Resolve the live token server-side so it re-checks compliance at scan time.
      const looksLikeLiveToken = scannedValue.split('.').length === 3;
      const status: ScanStatusResponse = looksLikeLiveToken
        ? await fetchScanByTokenRequest(token, scannedValue, assignedSite.id)
        : await fetchScanStatusRequest(token, scannedValue, assignedSite.id);
      setScannedUser(status.user);
      setAccessStatus(status.accessStatus);
      setCertificateStatus(status.certificateStatus);
      setAccessRequest(status.accessRequest);
      setLastActivity(status.lastActivity ?? null);
      setSmartLockEnforced(Boolean(status.smartLockEnforced));
      setScanRequired(status.scanRequired !== false);
      setAccessEnforcementMode(status.accessEnforcementMode ?? 'SecurityScan');
      setAccessEnforcementMessage(status.accessEnforcementMessage ?? null);
      setAssignedSite((prev) => {
        if (!prev || prev.id !== status.site.id) return prev;
        return {
          ...prev,
          name: status.site.name,
          requiredCertificates: status.site.requiredCertificates,
        };
      });

      if (status.user.idNumber) {
        try {
          const workerInfo = await fetchWorkerRequest(token, status.user.idNumber);
          setWorkerData({ jobTitle: workerInfo.jobTitle });
        } catch (error) {
          console.error('Failed to fetch worker data', error);
          setWorkerData(undefined);
        }
      } else {
        setWorkerData(undefined);
      }

      setDialogState('user-found');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not fetch user details.';
      if (message.toLowerCase().includes('not found')) {
        toast({ variant: 'destructive', title: 'Unknown User', description: `Scanned code "${scannedValue}" could not be resolved.` });
        setDialogState('no-user');
        setIsScannerPaused(true);
      } else {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch user details.' });
        setIsScannerPaused(false);
      }
    }
  };

  const handleCloseDialog = () => {
    setDialogState('closed');
    setScannedUser(null);
    setAccessStatus(null);
    setLastActivity(null);
    setCertificateStatus({ missing: [], expired: [] });
    setIsScannerPaused(false);
    setAccessRequest(null);
    setWorkerData(undefined);
    setSmartLockEnforced(false);
    setScanRequired(true);
    setAccessEnforcementMode('SecurityScan');
    setAccessEnforcementMessage(null);
  };

  if (authLoading) {
    return (
      <div className="grid min-h-[calc(100vh-10rem)] gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <Skeleton className="h-[30rem] w-full" />
        <Skeleton className="h-[30rem] w-full" />
      </div>
    );
  }

  if (!isAuthorized) {
    return <UnauthorizedComponent />;
  }

  return (
    <div className="space-y-4 md:space-y-5">
      <header className="flex flex-col gap-4 border-b border-border pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Gate Security Workstation</h1>
          <p className="text-sm text-muted-foreground">Scan identity, evaluate access, and record controlled movement.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="rounded-md px-3 py-1">
            <RadioTower className="mr-1.5 h-3.5 w-3.5" />
            Live
          </Badge>
          <Badge variant="outline" className="rounded-md px-3 py-1">
            <Building2 className="mr-1.5 h-3.5 w-3.5" />
            {loadingSite ? 'Loading site' : assignedSite?.name ?? 'No site'}
          </Badge>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <Card className="overflow-hidden border-border">
          <div className="border-b border-border bg-muted/40 px-5 py-4 text-foreground">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Camera className="h-4 w-4" />
              QR scanner
            </div>
            <h2 className="mt-1 text-xl font-semibold">Identity capture</h2>
          </div>
          <div className="p-4">
            <ScannerPreview onScanSuccess={handleScanSuccess} isPaused={isScannerPaused} />
            <div className="mt-3 rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              Position the QR code inside the frame. The backend evaluates request validity, certificate status, and current presence.
            </div>
          </div>
        </Card>

        <ScanDecisionPanel
          assignedSite={assignedSite}
          scannedUser={scannedUser}
          accessStatus={accessStatus}
          certificateStatus={certificateStatus}
          lastActivity={lastActivity}
          accessRequest={accessRequest}
          workerData={workerData}
          smartLockEnforced={smartLockEnforced}
          scanRequired={scanRequired}
          accessEnforcementMode={accessEnforcementMode}
          accessEnforcementMessage={accessEnforcementMessage}
          canRegisterVisitor={currentSecurityUser?.role === 'Admin' && !!assignedSite && !loadingSite}
          onRegisterVisitor={() => setDialogState('visitor-register')}
        />
      </div>

      <Dialog open={dialogState !== 'closed'} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="sm:max-w-2xl">
          {dialogState === 'user-found' && scannedUser && assignedSite && (
            <UserFoundDialog
              scannedUser={scannedUser}
              accessStatus={accessStatus}
              certificateStatus={certificateStatus}
              lastActivity={lastActivity}
              assignedSite={assignedSite}
              accessRequest={accessRequest}
              workerData={workerData}
              smartLockEnforced={smartLockEnforced}
              scanRequired={scanRequired}
              accessEnforcementMode={accessEnforcementMode}
              accessEnforcementMessage={accessEnforcementMessage}
              onClose={handleCloseDialog}
            />
          )}
          {dialogState === 'visitor-register' && assignedSite && (
            <VisitorRegistrationDialog
              assignedSite={assignedSite}
              onClose={handleCloseDialog}
            />
          )}
          {dialogState === 'no-user' && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Unknown User</AlertTitle>
              <AlertDescription>
                This QR code is not associated with any user. They can be registered as a new visitor.
              </AlertDescription>
            </Alert>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
