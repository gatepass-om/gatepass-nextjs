
export type UserRole = 'Admin' | 'Operator Admin' | 'Contractor Admin' | 'Manager' | 'Security' | 'Visitor' | 'Worker' | 'Supervisor';
export type UserStatus = 'Active' | 'Inactive';

export type Certificate = {
  name: string;
  expiryDate?: string; // ISO 8601 string (e.g., "yyyy-MM-dd")
}

export type UserPresence = {
  status: 'OnSite' | 'OffSite';
  lastActivityType?: string | null;
  lastGate?: string | null;
  lastSiteId?: string | null;
  lastSeenAt: string;
};

export type User = {
  id: string;
  name: string;
  email?: string;
  role: UserRole;
  status?: UserStatus;
  company?: string | null;
  operatorId?: string | null;
  contractorId?: string | null;
  nationality?: string | null;
  certificates?: Certificate[];
  avatarUrl?: string | null;
  idCardImageUrl?: string;
  idNumber?: string | null; // For manually entered ID
  notes?: string | null;
  assignedSiteId?: string | null;
  presence?: UserPresence;
};

export type AccessRequestStatus = 'Pending' | 'Approved' | 'Denied';

export type AccessRequest = {
  id: string;
  supervisorId: string;
  supervisorName: string;
  operatorId: string;
  operatorName: string;
  contractorId: string;
  contractorName: string;
  siteId: string;
  siteName: string;
  contractNumber: string;
  focalPoint: string;
  workerIds: string[];
  workers?: User[];
  workerCount?: number;
  onSiteCount?: number;
  status: AccessRequestStatus;
  requestedAt: string;
  validFrom?: string; // ISO 8601 Date string "yyyy-MM-dd"
  expiresAt?: string; // ISO 8601 Date string "yyyy-MM-dd" or "Permanent"
  notes?: string;
  siteRequiredCertificates?: string[];
};

export type ScanAccessRequest = {
  id: string;
  status: AccessRequestStatus | string;
  validFrom?: string;
  expiresAt?: string;
  permanent?: boolean;
};

export type GateActivity = {
  id: string;
  userId: string;
  userName:string;
  timestamp: string;
  type: 'CheckIn' | 'CheckOut' | 'Check-in' | 'Check-out';
  gate: string;
  siteId: string;
};

export type Site = {
    id: string;
    name: string;
    operatorId: string; // Link site to an operator
    managerIds: string[];
    requiredCertificates: string[];
}

export type CertificateType = {
    id: string;
    name: string;
}

export type Operator = {
    id: string;
    name: string;
}

export type Contractor = {
    id: string;
    name: string;
}

export type WorkerProfile = {
  id: string;
  name: string;
  email: string;
  company: string;
  age: number;
  nationality: string;
  jobTitle: string;
  idNumber: string;
  certificates: Certificate[];
};
