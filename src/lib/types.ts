
export type UserRole = 'Admin' | 'Operator Admin' | 'Contractor Admin' | 'Manager' | 'Security' | 'Visitor' | 'Worker' | 'Supervisor' | 'Consultant' | 'Inspector';
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
  tenantId?: string | null;
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
  impersonatedBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
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
    tenantId?: string | null;
    name: string;
    siteCount?: number;
    userCount?: number;
}

export type Contractor = {
    id: string;
    tenantId?: string | null;
    name: string;
    userCount?: number;
    requestCount?: number;
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

export type Tenant = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  defaultTimeZone: string;
  defaultCulture: string;
};

export type DecisionReasonOption = {
  value: number;
  name: string;
  label: string;
  description: string;
  isTolerable: boolean;
  isHardGuard: boolean;
};

export type EffectiveAccessRule = {
  key: string;
  label: string;
  enforcement: string;
  description: string;
  tenantConfigurable: boolean;
};

export type AccessRuleConfig = {
  tenantId: string;
  certificateExpiryGraceDays: number;
  toleratedReasons: number[];
  reasonOptions: DecisionReasonOption[];
  effectiveRules: EffectiveAccessRule[];
  updatedAtUtc?: string | null;
};

export type AccessDecisionEvaluation = {
  allowed: boolean;
  outcome: string;
  reason?: number | null;
  reasonName?: string | null;
  message?: string | null;
  accessRequestId?: string | null;
  missingCertificates: string[];
  evaluatedAtUtc: string;
  effectiveConfig: AccessRuleConfig;
};

export type CompanyUserSummary = {
  id: string;
  name: string;
  email?: string | null;
  role: string;
  status: string;
  jobTitle?: string | null;
};

export type CompanySiteSummary = {
  id: string;
  name: string;
  currentOnSiteCount: number;
  managerCount: number;
  requiredCertificateCount: number;
};

export type CompanyAccessRequestSummary = {
  id: string;
  operatorId: string;
  operatorName: string;
  contractorId: string;
  contractorName: string;
  siteId: string;
  siteName: string;
  supervisorName: string;
  status: string;
  contractNumber: string;
  requestedAtUtc: string;
  validFromUtc?: string | null;
  expiresAtUtc?: string | null;
  isPermanent: boolean;
  workerCount: number;
  currentOnSiteCount: number;
};

export type AttachedContractorSummary = {
  id: string;
  name: string;
  userCount: number;
  requestCount: number;
  activeRequestCount: number;
  siteCount: number;
  lastRequestAtUtc?: string | null;
};

export type AttachedOperatorSummary = {
  id: string;
  name: string;
  siteCount: number;
  requestCount: number;
  activeRequestCount: number;
  lastRequestAtUtc?: string | null;
};

export type OperatorDetail = {
  id: string;
  tenantId?: string | null;
  tenantName?: string | null;
  name: string;
  siteCount: number;
  userCount: number;
  contractorCount: number;
  activeRequestCount: number;
  sites: CompanySiteSummary[];
  personnel: CompanyUserSummary[];
  contractors: AttachedContractorSummary[];
  recentRequests: CompanyAccessRequestSummary[];
};

export type ContractorDetail = {
  id: string;
  tenantId?: string | null;
  tenantName?: string | null;
  name: string;
  userCount: number;
  requestCount: number;
  activeRequestCount: number;
  operatorCount: number;
  siteCount: number;
  personnel: CompanyUserSummary[];
  operators: AttachedOperatorSummary[];
  sites: CompanySiteSummary[];
  recentRequests: CompanyAccessRequestSummary[];
};
