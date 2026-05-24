
'use client'

import React, { useState } from 'react';
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import type { Site } from '@/lib/types';
import { X } from 'lucide-react';
import { useSession } from '@/providers/session-provider';
import { createGateActivityRequest, createUserRequest } from '@/lib/api';

interface VisitorRegistrationDialogProps {
  assignedSite: Site;
  onClose: () => void;
}

export function VisitorRegistrationDialog({ assignedSite, onClose }: VisitorRegistrationDialogProps) {
  const [visitorName, setVisitorName] = useState('');
  const [visitorCompany, setVisitorCompany] = useState('');
  const [visitorEmail, setVisitorEmail] = useState('');
  const [visitorIdNumber, setVisitorIdNumber] = useState('');
  
  const { token } = useSession();
  const { toast } = useToast();

  const handleRegisterVisitorAndCheckIn = async () => {
    if (!token) {
      toast({ variant: 'destructive', title: 'Session expired', description: 'Please log in again to continue.' });
      return;
    }
    if (!visitorName) {
      toast({ variant: 'destructive', title: 'Missing Information', description: 'Please provide the visitor\'s name.' });
      return;
    }
    try {
      // 1. Create the visitor user profile
      const createResult = await createUserRequest(token, {
        name: visitorName,
        company: visitorCompany || undefined,
        email: visitorEmail || `visitor_${Date.now()}@gatepass.local`,
        role: 'Visitor',
        status: 'Active',
        idNumber: visitorIdNumber || undefined,
        sendWelcomeEmail: false,
      });
      const newUser = createResult.user;
      toast({ title: 'Visitor Registered', description: `${visitorName} has been created.` });

      // 2. Immediately check them in
      await createGateActivityRequest(token, {
        userId: newUser.id,
        siteId: assignedSite.id,
        gate: `${assignedSite.name} Main Gate`,
        type: 'CheckIn',
      });
      toast({ title: `Check-in Successful`, description: `${newUser.name} has been checked in.` });

      onClose();

    } catch (error) {
      console.error("Error registering visitor:", error);
      toast({ variant: 'destructive', title: 'Registration Failed', description: 'Could not create visitor profile.' });
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Register New Visitor</DialogTitle>
        <DialogDescription>Enter the visitor's details to grant access.</DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 py-4">
        <Input placeholder="Full Name *" value={visitorName} onChange={(e) => setVisitorName(e.target.value)} />
        <Input placeholder="Company (Optional)" value={visitorCompany} onChange={(e) => setVisitorCompany(e.target.value)} />
        <Input type="email" placeholder="Email (Optional)" value={visitorEmail} onChange={(e) => setVisitorEmail(e.target.value)} />
        <Input placeholder="ID Card or Driver's License # (Optional)" value={visitorIdNumber} onChange={(e) => setVisitorIdNumber(e.target.value)} />
      </div>
      <DialogFooter>
        <Button onClick={handleRegisterVisitorAndCheckIn} disabled={!visitorName}>Register and Check-in</Button>
      </DialogFooter>
      <DialogClose asChild>
          <Button variant="ghost" size="icon" className="absolute top-4 right-4" onClick={onClose}>
              <X className="h-4 w-4" />
          </Button>
      </DialogClose>
    </>
  );
}
