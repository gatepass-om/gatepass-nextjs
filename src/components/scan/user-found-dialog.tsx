
'use client'

import React from 'react';
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { User, Site, ScanAccessRequest } from '@/lib/types';
import { Check, LogOut, User as UserIcon, Building, X, AlertTriangle, ShieldX, LogIn, FileWarning, CalendarDays, Briefcase, BadgeCheck } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useSession } from '@/providers/session-provider';
import { createGateActivityRequest } from '@/lib/api';

interface UserFoundDialogProps {
  scannedUser: User;
  accessStatus: 'approved' | 'denied-no-request' | 'denied-expired' | 'denied-not-started' | null;
  certificateStatus: { missing: string[], expired: string[] };
  lastActivity: 'CheckIn' | 'CheckOut' | null;
  assignedSite: Site;
  accessRequest: ScanAccessRequest | null;
  workerData?: { jobTitle?: string };
  smartLockEnforced?: boolean;
  scanRequired?: boolean;
  accessEnforcementMessage?: string | null;
  onClose: () => void;
}

export function UserFoundDialog({ scannedUser, accessStatus, certificateStatus, lastActivity, assignedSite, accessRequest, workerData, smartLockEnforced = false, scanRequired = true, accessEnforcementMessage, onClose }: UserFoundDialogProps) {
  const { toast } = useToast();
  const { token } = useSession();

  const handleActivity = async (type: 'CheckIn' | 'CheckOut') => {
    if (!token) {
      toast({ variant: 'destructive', title: 'Session expired', description: 'Please log in again to continue.' });
      return;
    }

    const label = type === 'CheckIn' ? 'Check-in' : 'Check-out';
    try {
      await createGateActivityRequest(token, {
        userId: scannedUser.id,
        siteId: assignedSite.id,
        gate: `${assignedSite.name} Main Gate`,
        type,
      });
      toast({ title: `${label} Successful`, description: `${scannedUser.name} has been checked ${label.toLowerCase()}.` });
    } catch (e) {
      console.error("Error adding gate activity:", e);
      toast({ variant: 'destructive', title: 'Error', description: `Failed to record ${label}.` });
    }
    onClose();
  };

  const showCheckIn = lastActivity !== 'CheckIn';
  const hasCertificateIssues = certificateStatus.missing.length > 0 || certificateStatus.expired.length > 0;
  const isAccessGranted = accessStatus === 'approved' && !hasCertificateIssues;

  const getAccessDeniedReason = () => {
    switch(accessStatus) {
        case 'denied-no-request': return 'No approved access request found for today.';
        case 'denied-expired': return 'Access request has expired.';
        case 'denied-not-started': return 'Access request validity has not started yet.';
        default: return 'Access denied due to an unknown reason.';
    }
  }
  
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Scan Successful</DialogTitle>
        <DialogDescription>User profile found. Please verify and proceed.</DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 py-4">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="h-20 w-20 flex items-center justify-center rounded-full bg-muted text-muted-foreground font-semibold text-3xl">
              {getInitials(scannedUser.name)}
          </div>
          <div className="space-y-1 text-center sm:text-left">
            <h3 className="text-xl font-semibold">{scannedUser.name}</h3>
            <div className="flex items-center justify-center sm:justify-start gap-2 text-muted-foreground">
              <UserIcon className="h-4 w-4" /> <span>{scannedUser.role}</span>
            </div>
             {workerData?.jobTitle && (
               <div className="flex items-center justify-center sm:justify-start gap-2 text-muted-foreground">
                  <Briefcase className="h-4 w-4" /> <span>{workerData.jobTitle}</span>
               </div>
             )}
            <div className="flex items-center justify-center sm:justify-start gap-2 text-muted-foreground">
              <Building className="h-4 w-4" /> <span>{scannedUser.company || 'N/A'}</span>
            </div>
             {lastActivity && (
                 <Badge variant={lastActivity === 'CheckIn' ? 'default' : 'secondary'} className={lastActivity === 'CheckIn' ? 'bg-primary/20 text-primary border-transparent hover:bg-primary/30' : 'bg-muted text-muted-foreground border-transparent hover:bg-muted/80'}>
                    {lastActivity === 'CheckIn' ? 'Currently On-Site' : 'Currently Off-Site'}
                </Badge>
            )}
          </div>
        </div>
        <div className="space-y-2">
           {smartLockEnforced && (
              <Alert>
                <BadgeCheck className="h-4 w-4" />
                <AlertTitle>Smart lock access</AlertTitle>
                <AlertDescription>
                  {accessEnforcementMessage ?? 'Scanning is not required for this locked access path. Check-in is performed only in the mobile app using the provisioned smart-lock credential.'}
                </AlertDescription>
              </Alert>
           )}
           <Badge className={`w-full justify-center text-base py-1 px-3 ${isAccessGranted ? 'bg-success/20 text-success border-transparent hover:bg-success/30' : 'bg-danger/20 text-danger border-transparent hover:bg-danger/30'}`}>
              {isAccessGranted ? <Check className="mr-2 h-5 w-5" /> : <ShieldX className="mr-2 h-5 w-5" />}
              {isAccessGranted ? 'Access Approved' : 'Access Denied'}
            </Badge>
        
            {accessRequest && (
              <Alert variant="default" className="flex items-start gap-3">
                <CalendarDays className="h-4 w-4 mt-1" />
                <div>
                    <AlertTitle>Access Validity</AlertTitle>
                    <AlertDescription>
                        {accessRequest.validFrom ? format(parseISO(accessRequest.validFrom), 'PPP') : 'N/A'} - {accessRequest.expiresAt === 'Permanent' ? 'Permanent' : accessRequest.expiresAt ? format(parseISO(accessRequest.expiresAt), 'PPP') : 'N/A'}
                    </AlertDescription>
                </div>
              </Alert>
            )}

          {accessStatus !== 'approved' && accessStatus !== null && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Access Request Issue</AlertTitle>
              <AlertDescription>
                {getAccessDeniedReason()}
              </AlertDescription>
            </Alert>
          )}

           {hasCertificateIssues && (
             <Alert variant="destructive">
                <FileWarning className="h-4 w-4" />
                <AlertTitle>Certificate Issue</AlertTitle>
                <AlertDescription>
                    {certificateStatus.missing.length > 0 && <div>Missing: {certificateStatus.missing.join(', ')}</div>}
                    {certificateStatus.expired.length > 0 && <div>Expired: {certificateStatus.expired.join(', ')}</div>}
                </AlertDescription>
             </Alert>
           )}
        </div>
      </div>
      <DialogFooter>
        {!scanRequired || smartLockEnforced ? (
          <Button className="w-full" variant="outline" onClick={onClose}>Close</Button>
        ) : showCheckIn ? (
             <Button className="w-full" onClick={() => handleActivity('CheckIn')} disabled={!isAccessGranted}><LogIn className="mr-2 h-4 w-4" /> Check-in</Button>
        ) : (
            <Button variant="outline" className="w-full" onClick={() => handleActivity('CheckOut')}><LogOut className="mr-2 h-4 w-4" /> Check-out</Button>
        )}
      </DialogFooter>
       <DialogClose asChild>
          <Button variant="ghost" size="icon" className="absolute top-4 right-4" onClick={onClose}>
              <X className="h-4 w-4" />
          </Button>
      </DialogClose>
    </>
  );
}
