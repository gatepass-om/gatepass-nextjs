
export type UserRole = 'Admin' | 'Operator Admin' | 'Contractor Admin' | 'Manager' | 'Security' | 'Visitor' | 'Worker' | 'Supervisor' | 'Inspector';
export type UserStatus = 'Active' | 'Inactive';

export type Certificate = {
  id?: string;
  certificateTypeId: string;
  name?: string;
  expiresAtUtc?: string | null;
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
  email?: string | null;
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
  interactiveAccountEnabled?: boolean;
  preferredName?: string | null;
  nameInOriginalScript?: string | null;
  phoneticName?: string | null;
  preferredLanguage?: string | null;
  secondaryLanguages?: string[];
  preferredInteractionMode?: 'Web' | 'MobileApp' | 'PrintedCard' | 'Kiosk' | 'Sms' | 'SupervisorAssisted' | null;
  needsAssistedWorkflow?: boolean;
  personalDeviceAvailable?: boolean;
  canReceiveSms?: boolean;
  offlineCardRequired?: boolean;
  audioInstructionsPreferred?: boolean;
  largeTextPreferred?: boolean;
  interpreterRequired?: boolean;
  registrationChannel?: 'SelfService' | 'Assisted' | 'BulkImport' | 'Kiosk' | 'Integration' | null;
  clearanceStatus?: 'Pending' | 'Submitted' | 'UnderReview' | 'Cleared' | 'Returned' | null;
  assignedSiteId?: string | null;
  employment?: WorkerEmployment | null;
  presence?: UserPresence;
  impersonatedBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
};

export type AccessRequestStatus = 'Pending' | 'Approved' | 'Denied' | 'Expired';

export type AccessRequestWorker = {
  userId: string;
  name: string;
  role: string;
  workerCode?: string | null;
  employerName?: string | null;
  jobTitle?: string | null;
  isActive: boolean;
  missingCertificates: string[];
};

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
  workers: AccessRequestWorker[];
  currentOnSiteCount: number;
  status: AccessRequestStatus;
  requestedAtUtc: string;
  validFromUtc?: string | null;
  expiresAtUtc?: string | null;
  isPermanent: boolean;
  notes?: string;
  siteRequiredCertificates?: string[];
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
    requiresAccessApproval?: boolean;
    usesSecurityCheckpoints?: boolean;
    usesSmartAccess?: boolean;
    maximumOccupancy?: number;
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
    companyType?: ExternalCompanyType | keyof typeof ExternalCompanyTypeNames;
    userCount?: number;
    requestCount?: number;
}

export const ExternalCompanyTypeNames = {
  Contractor: 1,
  Consultant: 2,
  Vendor: 3,
  Subcontractor: 4,
  Auditor: 5,
  Other: 6,
} as const;

export type ExternalCompanyType = typeof ExternalCompanyTypeNames[keyof typeof ExternalCompanyTypeNames];

export type WorkerEmployment = {
  id: string;
  contractorId?: string | null;
  operatorId?: string | null;
  employeeNumber?: string | null;
  trade?: string | null;
  jobPositionId?: string | null;
  jobPositionName?: string | null;
  department?: string | null;
  supervisorUserId?: string | null;
  employmentType: string;
  validFromUtc: string;
  validToUtc?: string | null;
};

export type JobPositionCredentialRequirement = {
  certificateTypeId: string;
  certificateTypeName: string;
  minimumValidityDays: number;
};

export type JobPosition = {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  credentialRequirements: JobPositionCredentialRequirement[];
};

export type ProjectRole = {
  id: string;
  name: string;
  grantsFullProjectAccess: boolean;
  isSecondSignatory: boolean;
  canManageCrew: boolean;
  isDefault: boolean;
  dutyKeys: string[];
};

export type WorkerPositionCompliance = {
  userId: string;
  jobPositionId?: string | null;
  jobPositionName?: string | null;
  isCompliant: boolean;
  credentials: Array<{
    certificateTypeId: string;
    certificateTypeName: string;
    minimumValidityDays: number;
    expiresAtUtc?: string | null;
    status: 'Missing' | 'Expired' | 'InsufficientValidity' | 'Valid' | string;
  }>;
};

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
