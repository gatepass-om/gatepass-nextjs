
'use client'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AccessRequest, User, Certificate as CertificateType, Site } from "@/lib/types";
import { format, isBefore, parseISO } from 'date-fns';
import { Briefcase, Building, Calendar, Contact, FileBadge, Hash, MessageSquare, ShieldAlert, ShieldCheck, User as UserIcon, Users } from "lucide-react";
import { useWorkerData } from "@/hooks/use-worker-data";
import { useFirestore } from "@/firebase";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { Textarea } from "../ui/textarea";

interface RequestDetailsDialogProps {
  request: AccessRequest;
  allUsers: User[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const isCertificateExpired = (expiryDate?: string) => {
    if (!expiryDate) return false;
    return isBefore(parseISO(expiryDate), new Date());
};

const WorkerDetails = ({ worker, site }: { worker: User, site: Site | null}) => {
    const { workerData, loading } = useWorkerData(worker.idNumber);
    const requiredCerts = site?.requiredCertificates || [];

    const userCerts = worker.certificates || [];
    const userCertNames = userCerts.map(c => c.name);

    const missingRequiredCerts = requiredCerts.filter(rc => !userCertNames.includes(rc));

    return (
        <div className="p-3 rounded-md bg-muted/50 border flex flex-col gap-3">
            <div className="font-semibold">{worker.name}</div>
            <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                <span>{loading ? 'Loading...' : workerData?.jobTitle || 'N/A'}</span>
            </div>
             {userCerts.length > 0 && (
                 <div className="space-y-2">
                    {userCerts.map((cert, index) => {
                        const isExpired = isCertificateExpired(cert.expiryDate);
                        return (
                            <div key={index} className="flex items-start gap-2 text-sm">
                                {isExpired ? <ShieldAlert className="h-4 w-4 text-destructive mt-0.5" /> : <ShieldCheck className="h-4 w-4 text-primary mt-0.5" />}
                                <div>
                                    <p className="font-medium">{cert.name}</p>
                                    <p className={cn("text-xs text-muted-foreground", isExpired && "text-destructive font-semibold")}>
                                        {cert.expiryDate ? `Expires: ${format(parseISO(cert.expiryDate), 'PPP')}` : 'No expiry'}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
             {missingRequiredCerts.length > 0 && (
                <div className="space-y-2">
                    {missingRequiredCerts.map((certName) => (
                        <div key={certName} className="flex items-start gap-2 text-sm text-destructive">
                             <ShieldAlert className="h-4 w-4 mt-0.5" />
                             <div>
                                 <p className="font-medium">{certName}</p>
                                 <p className="text-xs font-semibold">Missing Required Certificate</p>
                             </div>
                        </div>
                    ))}
                </div>
            )}

             {userCerts.length === 0 && missingRequiredCerts.length === 0 && (
                <p className="text-xs text-muted-foreground italic">No certificate information available for this worker.</p>
             )}
        </div>
    );
};


export function RequestDetailsDialog({ request, allUsers, open, onOpenChange }: RequestDetailsDialogProps) {

  const firestore = useFirestore();
  const [siteDetails, setSiteDetails] = useState<Site | null>(null);

  useEffect(() => {
    if (!firestore || !request?.siteId) return;
    const siteRef = doc(firestore, 'sites', request.siteId);
    getDoc(siteRef).then(docSnap => {
        if (docSnap.exists()) {
            setSiteDetails({id: docSnap.id, ...docSnap.data()} as Site);
        }
    })
  }, [firestore, request?.siteId])

  const workersInRequest = request.workerIds.map(id => allUsers.find(u => u.id === id)).filter(Boolean) as User[];
  

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl w-[90vw] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Access Request Details</SheetTitle>
          <SheetDescription>
            Read-only view of the request submitted by {request.supervisorName}.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-6 py-6">
            
            <div className="space-y-4 p-4 rounded-lg border bg-background">
                <h3 className="font-semibold text-lg">Contract Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="grid w-full items-center gap-1.5">
                        <Label htmlFor="operatorName">Operator</Label>
                        <Input id="operatorName" value={request.operatorName} readOnly disabled icon={Building} />
                    </div>
                     <div className="grid w-full items-center gap-1.5">
                        <Label htmlFor="siteName">Site</Label>
                        <Input id="siteName" value={request.siteName} readOnly disabled icon={Building} />
                    </div>
                     <div className="grid w-full items-center gap-1.5">
                        <Label htmlFor="contractNumber">Contract Number</Label>
                        <Input id="contractNumber" value={request.contractNumber} readOnly disabled icon={Hash} />
                    </div>
                </div>
                 {request.notes && (
                    <div className="grid w-full items-center gap-1.5 pt-4">
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea id="notes" value={request.notes} readOnly disabled className="h-24"/>
                    </div>
                )}
            </div>

            <div className="space-y-4 p-4 rounded-lg border bg-background">
                <h3 className="font-semibold text-lg flex items-center gap-2"><Users className="h-5 w-5"/>Personnel ({workersInRequest.length})</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {workersInRequest.map(worker => (
                        <WorkerDetails key={worker.id} worker={worker} site={siteDetails} />
                    ))}
                </div>
            </div>

        </div>
        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// Add icon prop to Input component's interface
declare module "react" {
    interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
        icon?: React.ElementType;
    }
}
