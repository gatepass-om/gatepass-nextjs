'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ScanAccessRequest, Site, User } from '@/lib/types';
import { AlertTriangle, BadgeCheck, Building2, CalendarClock, FileWarning, IdCard, LogIn, LogOut, ShieldCheck, ShieldX, UserPlus } from 'lucide-react';

type CertificateStatus = {
  missing: string[];
  expired: string[];
};

type ScanDecisionPanelProps = {
  assignedSite: Site | null;
  scannedUser: User | null;
  accessStatus: 'approved' | 'denied-no-request' | 'denied-expired' | 'denied-not-started' | null;
  certificateStatus: CertificateStatus;
  lastActivity: 'CheckIn' | 'CheckOut' | null;
  accessRequest: ScanAccessRequest | null;
  workerData?: { jobTitle?: string };
  smartLockEnforced?: boolean;
  scanRequired?: boolean;
  accessEnforcementMode?: 'None' | 'SecurityScan' | 'MobileSmartLock' | 'Hybrid';
  accessEnforcementMessage?: string | null;
  canRegisterVisitor: boolean;
  onRegisterVisitor: () => void;
};

function getAccessMessage(accessStatus: ScanDecisionPanelProps['accessStatus']) {
  switch (accessStatus) {
    case 'approved':
      return 'Approved for this site';
    case 'denied-no-request':
      return 'No approved request';
    case 'denied-expired':
      return 'Access window expired';
    case 'denied-not-started':
      return 'Access window not started';
    default:
      return 'Waiting for scan';
  }
}

export function ScanDecisionPanel({
  assignedSite,
  scannedUser,
  accessStatus,
  certificateStatus,
  lastActivity,
  accessRequest,
  workerData,
  smartLockEnforced = false,
  scanRequired = true,
  accessEnforcementMode = 'SecurityScan',
  accessEnforcementMessage,
  canRegisterVisitor,
  onRegisterVisitor,
}: ScanDecisionPanelProps) {
  const hasCertificateIssues = certificateStatus.missing.length > 0 || certificateStatus.expired.length > 0;
  const isApproved = accessStatus === 'approved' && !hasCertificateIssues;
  const isOnSite = lastActivity === 'CheckIn';
  const isHybrid = accessEnforcementMode === 'Hybrid';
  const tracksPresence = accessEnforcementMode !== 'None';

  return (
    <Card className="border-border">
      <CardHeader className="border-b border-border pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Decision Console</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Operational decision state for the active scan.</p>
          </div>
          <Badge className={isApproved ? 'bg-success/15 text-success border border-success/30 hover:bg-success/15' : scannedUser ? 'bg-danger/15 text-danger border border-danger/30 hover:bg-danger/15' : 'bg-muted text-muted-foreground border border-border hover:bg-muted'}>
            {smartLockEnforced ? <BadgeCheck className="mr-1.5 h-3.5 w-3.5" /> : isApproved ? <ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> : scannedUser ? <ShieldX className="mr-1.5 h-3.5 w-3.5" /> : <IdCard className="mr-1.5 h-3.5 w-3.5" />}
            {isHybrid ? 'Hybrid access' : smartLockEnforced ? 'Smart lock enforced' : getAccessMessage(accessStatus)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-5">
        <div className="rounded-md border border-border p-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building2 className="h-4 w-4" />
            Assigned site
          </div>
          <div className="mt-1 font-semibold">{assignedSite?.name ?? 'No site assigned'}</div>
        </div>

        {scannedUser ? (
          <div className="space-y-3">
            {smartLockEnforced && (
              <Alert>
                <BadgeCheck className="h-4 w-4" />
                <AlertTitle>{isHybrid ? 'Smart or guarded entry' : 'Scanning not required'}</AlertTitle>
                <AlertDescription>
                  {accessEnforcementMessage ?? 'This access path is enforced by a smart lock. Check-in is performed only in the mobile app using the provisioned credential.'}
                </AlertDescription>
              </Alert>
            )}
            <div className="flex items-start gap-3 rounded-md border border-border p-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
                {scannedUser.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="truncate font-semibold">{scannedUser.name}</div>
                <div className="mt-1 text-sm text-muted-foreground">{workerData?.jobTitle || scannedUser.role}</div>
                <div className="mt-1 text-xs text-muted-foreground">{scannedUser.company || 'No company recorded'}</div>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-md border border-border p-3">
                <div className="text-xs uppercase text-muted-foreground">Presence</div>
                <div className="mt-1 flex items-center gap-2 font-medium">
                  {isOnSite ? <LogIn className="h-4 w-4 text-accent" /> : <LogOut className="h-4 w-4 text-muted-foreground" />}
                  {tracksPresence ? (isOnSite ? 'On site' : 'Off site') : 'Compliance only'}
                </div>
              </div>
              <div className="rounded-md border border-border p-3">
                <div className="text-xs uppercase text-muted-foreground">Request</div>
                <div className="mt-1 flex items-center gap-2 font-medium">
                  <CalendarClock className="h-4 w-4 text-muted-foreground" />
                  {accessRequest ? accessRequest.status : 'None'}
                </div>
              </div>
            </div>

            {hasCertificateIssues && (
              <Alert variant="destructive">
                <FileWarning className="h-4 w-4" />
                <AlertTitle>Certificate hold</AlertTitle>
                <AlertDescription>
                  {certificateStatus.missing.length > 0 && <div>Missing: {certificateStatus.missing.join(', ')}</div>}
                  {certificateStatus.expired.length > 0 && <div>Expired: {certificateStatus.expired.join(', ')}</div>}
                </AlertDescription>
              </Alert>
            )}
          </div>
        ) : (
          <Alert>
            <BadgeCheck className="h-4 w-4" />
            <AlertTitle>Ready to scan</AlertTitle>
            <AlertDescription>Scan a worker, visitor, supervisor, or contractor QR code to evaluate access.</AlertDescription>
          </Alert>
        )}

        {!assignedSite && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>No assigned site</AlertTitle>
            <AlertDescription>Security users must be assigned to a site before scanning can start.</AlertDescription>
          </Alert>
        )}

        <Button className="w-full" variant="outline" onClick={onRegisterVisitor} disabled={!canRegisterVisitor}>
          <UserPlus className="mr-2 h-4 w-4" />
          Register visitor
        </Button>
      </CardContent>
    </Card>
  );
}
