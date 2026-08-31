import type { AccessDecisionEvaluation, AccessRequest, AccessRuleConfig, ContractorDetail, DecisionReasonOption, OperatorDetail, Tenant, User, WorkerProfile } from './types';
import { normalizeUserProfile } from './user-profile';

export const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4005').replace(/\/$/, '');

// The session provider registers a refresh hook here so token-bearing requests can transparently recover from a
// 401 (expired access token) without every caller wiring up its own refresh logic.
type SessionBridge = { refresh: () => Promise<string | null> };
let sessionBridge: SessionBridge | null = null;
export function setSessionBridge(bridge: SessionBridge | null) {
  sessionBridge = bridge;
}

// Lets non-apiRequest callers (notably the SSE stream, which manages its own fetch) trigger the same shared silent
// refresh on a 401 and obtain the rotated access token.
export async function refreshAccessToken(): Promise<string | null> {
  return sessionBridge ? sessionBridge.refresh() : null;
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: Record<string, unknown>;
  token?: string | null;
  // Send/receive cookies (the httpOnly refresh cookie). Only the /auth endpoints need this.
  withCredentials?: boolean;
};

const API_REQUEST_TIMEOUT_MS = 15_000;

export async function apiRequest<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const { method = 'GET', body, token, withCredentials } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${BACKEND_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      credentials: withCredentials ? 'include' : 'same-origin',
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('The GatePass service did not respond in time. Check the connection and try again.');
    }
    throw new Error('The GatePass service is unavailable. Check the connection and try again.');
  } finally {
    clearTimeout(timeout);
  }

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    // Transparently recover from an expired access token: perform one shared silent refresh, then retry once.
    // Auth endpoints are excluded (they manage tokens themselves) and isRetry guards against loops.
    if (response.status === 401 && token && !isRetry && !path.startsWith('/auth') && sessionBridge) {
      const refreshedToken = await sessionBridge.refresh();
      if (refreshedToken && refreshedToken !== token) {
        return apiRequest<T>(path, { ...options, token: refreshedToken }, true);
      }
    }
    const message = typeof data === 'object' && data !== null && 'error' in data
      ? String((data as { error?: unknown }).error ?? 'Request failed')
      : typeof data === 'string' && data.trim()
        ? data
        : 'Request failed';
    throw new Error(message);
  }

  return data as T;
}

export type LoginResponse = {
  token: string;
  expiresAt?: string;
  expiresAtUtc?: string;
  user: User;
};

export type DashboardBreakdown = {
  id: string;
  name: string;
  count: number;
};

export type DashboardRecentActivity = {
  id: string;
  userId: string;
  userName: string;
  workerCode?: string | null;
  jobTitle?: string | null;
  siteId: string;
  siteName: string;
  gateName: string;
  activityType: 'CheckIn' | 'CheckOut' | string;
  occurredAtUtc: string;
};

export type DashboardSummary = {
  generatedAtUtc: string;
  window: {
    fromUtc: string;
    toUtc: string;
    durationHours: number;
  };
  movements: {
    entries: number;
    exits: number;
    denied: number;
    manualOverrides: number;
    total: number;
  };
  workforce: {
    eligibleWorkers: number;
    pendingWorkers: number;
    submittedWorkers: number;
    underReviewWorkers: number;
    clearedWorkers: number;
    returnedWorkers: number;
    readinessRate: number;
  };
  portfolio: {
    registeredWorkers: number;
    projects: number;
    sites: number;
    externalCompanies: number;
    consultants: number;
  };
  accessRequests: Array<{
    id: string;
    status: 'Pending' | 'Approved' | 'Denied' | string;
    siteId: string;
    siteName: string;
    contractorId: string;
    contractorName: string;
    contractNumber: string;
    requestedAtUtc: string;
    workerCount: number;
  }>;
  mapSites: Array<{
    siteId: string;
    siteName: string;
    registeredWorkers: number;
    projects: number;
    externalCompanies: number;
    pendingRequests: number;
    approvedRequests: number;
    deniedRequests: number;
  }>;
  expiry: {
    expired: number;
    next7Days: number;
    days8To30: number;
    days31To60: number;
    days61To90: number;
  };
  actionQueue: Array<{
    key: string;
    label: string;
    count: number;
    overdueCount: number;
    oldestAtUtc?: string | null;
    severity: 'info' | 'warning' | 'danger' | string;
    href: string;
    applicable: boolean;
  }>;
  operatingModes: {
    totalSites: number;
    authorizationRequiredSites: number;
    complianceOnlySites: number;
    checkpointSites: number;
    openAreaSites: number;
    smartAccessSites: number;
    manualOperationSites: number;
  };
  audience: {
    role: string;
    profileKey: string;
    visiblePanels: string[];
    metricKeys: string[];
    panelKeys: string[];
  };
  contractorScorecards: Array<{
    id: string;
    name: string;
    eligibleWorkers: number;
    clearedWorkers: number;
    readinessRate: number;
    onSiteWorkers: number;
    pendingDocumentWorkers: number;
    expiringCredentialWorkers: number;
  }>;
  projectScorecards: Array<{
    id: string;
    name: string;
    status: string;
    validFromUtc: string;
    validToUtc: string;
    members: number;
    workPasses: number;
    activeWorkPasses: number;
  }>;
  competencies: {
    verified: number;
    unverified: number;
    expired: number;
    expiringIn30Days: number;
  };
  cards: {
    issuedNotPrinted: number;
    printed: number;
    expired: number;
    revokedOrReplaced: number;
    missing: number;
  };
  adoption: {
    privacySuppressed: boolean;
    interactiveAccounts: number | null;
    managedProfiles: number | null;
    assistedWorkflowWorkers: number | null;
    workersWithoutPersonalDevice: number | null;
    offlineCardRequiredWorkers: number | null;
    minimumGroupSize: number;
    registrationChannels: DashboardBreakdown[];
    preferredLanguages: DashboardBreakdown[];
    interactionModes: DashboardBreakdown[];
  };
  registrationFunnel: {
    privacySuppressed: boolean;
    minimumGroupSize: number;
    coverageStartedAtUtc?: string | null;
    cohortWorkers: number | null;
    profileCompletedWorkers: number | null;
    evidenceStartedWorkers: number | null;
    submittedWorkers: number | null;
    underReviewWorkers: number | null;
    clearedWorkers: number | null;
    returnedWorkers: number | null;
    stalledBeforeSubmissionWorkers: number | null;
    submissionRate: number | null;
    clearanceRate: number | null;
  };
  dataQuality: {
    eligibleWorkers: number;
    missingWorkerProfiles: number;
    missingIdentityDocuments: number;
    unverifiedIdentityDocuments: number;
    missingContractor: number;
    missingJobTitle: number;
    missingUsableCards: number;
    staleIdentityVerifications: number;
    stalePresenceRecords: number;
    occupancyMismatchSites: number;
    profileCompletenessRate: number;
  };
  trends: Array<{
    date: string;
    movements: number;
    entries: number;
    exits: number;
    denied: number;
  }>;
  comparison: {
    currentMovements: number;
    previousMovements: number;
    movementChangePercent?: number | null;
    currentDecisions: number;
    currentApprovalRate: number;
    previousApprovalRate: number;
  };
  turnaround: {
    approvals: {
      sampleSize: number;
      medianHours: number | null;
      p90Hours: number | null;
    };
    onboarding: {
      sampleSize: number;
      medianHours: number | null;
      p90Hours: number | null;
    };
  };
  peakOccupancy: {
    total: number;
    peakAtUtc: string | null;
    sites: Array<{
      siteId: string;
      siteName: string;
      peakOccupancy: number;
      peakAtUtc: string | null;
    }>;
  };
  attendance: {
    configuredRosters: number;
    activeRosters: number;
    expectedWorkers: number;
    presentWorkers: number;
    absentWorkers: number;
    rosters: Array<{
      id: string;
      name: string;
      siteId: string;
      siteName: string;
      expectedWorkers: number;
      presentWorkers: number;
      absentWorkers: number;
    }>;
  };
  capacity: {
    configuredSites: number;
    totalCapacity: number;
    currentOccupancy: number;
    occupancyRate: number;
    atCapacitySites: number;
    overCapacitySites: number;
    sites: Array<{
      siteId: string;
      siteName: string;
      currentOccupancy: number;
      maximumOccupancy: number;
      occupancyRate: number;
    }>;
  };
  bottlenecks: Array<{
    key: string;
    label: string;
    count: number;
    overdueCount: number;
  }>;
  totalOnSite: number;
  pendingRequests: number;
  approvedRequests: number;
  deniedRequests: number;
  clearedWorkers: number;
  workersWithExpiringCertificates: number;
  flaggedWorkers: number;
  sites: DashboardBreakdown[];
  operators: DashboardBreakdown[];
  contractors: DashboardBreakdown[];
  nationalities: DashboardBreakdown[];
  recentActivity: DashboardRecentActivity[];
};

export async function loginRequest(input: { identifier: string; password: string }) {
  return apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    body: input,
    withCredentials: true,
  });
}

export async function activateRequest(input: { token: string; newPassword: string }) {
  const { token, newPassword } = input;
  return apiRequest<LoginResponse>('/auth/activate', {
    method: 'POST',
    token,
    body: { newPassword },
    withCredentials: true,
  });
}

export async function activateInvitationRequest(input: { userId: string; token: string; newPassword: string }) {
  return apiRequest<LoginResponse>('/auth/activate-invitation', {
    method: 'POST',
    body: input,
    withCredentials: true,
  });
}

// Exchanges the httpOnly refresh cookie for a fresh access token (rotating the refresh cookie).
export async function refreshSessionRequest() {
  return apiRequest<LoginResponse>('/auth/refresh', {
    method: 'POST',
    withCredentials: true,
  });
}

// Revokes the current refresh token server-side and clears the cookie.
export async function logoutRequest() {
  await apiRequest<null>('/auth/logout', {
    method: 'POST',
    withCredentials: true,
  });
}

export async function impersonateUserRequest(token: string, userId: string) {
  return apiRequest<LoginResponse>('/auth/impersonate', {
    method: 'POST',
    token,
    body: { userId },
  });
}

export async function fetchCurrentUserRequest(token: string) {
  const user = await apiRequest<User & { identityNumber?: string | null; employerName?: string | null }>('/users/me', {
    method: 'GET',
    token,
  });
  return normalizeUserProfile(user);
}

export type DashboardAccessRequestStatusFilter = 'Pending' | 'Approved' | 'Denied';

export async function fetchDashboardSummaryRequest(
  token: string,
  input?: {
    operatorId?: string;
    siteId?: string;
    externalCompanyId?: string;
    accessRequestStatus?: DashboardAccessRequestStatusFilter;
    fromUtc?: string;
    toUtc?: string;
  }
) {
  const params = new URLSearchParams();
  if (input?.operatorId && input.operatorId !== 'all') params.set('operatorId', input.operatorId);
  if (input?.siteId && input.siteId !== 'all') params.set('siteId', input.siteId);
  if (input?.externalCompanyId && input.externalCompanyId !== 'all') params.set('externalCompanyId', input.externalCompanyId);
  if (input?.accessRequestStatus) params.set('accessRequestStatus', input.accessRequestStatus);
  if (input?.fromUtc) params.set('fromUtc', input.fromUtc);
  if (input?.toUtc) params.set('toUtc', input.toUtc);
  const query = params.toString();
  return apiRequest<DashboardSummary>(`/dashboard/summary${query ? `?${query}` : ''}`, { token });
}

export type ReportSchedule = {
  id: string;
  name: string;
  siteId?: string | null;
  frequency: 'Daily' | 'Weekly' | 'Monthly' | string;
  timeZoneId: string;
  localHour: number;
  localMinute: number;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  isActive: boolean;
  nextRunAtUtc: string;
  lastRunAtUtc?: string | null;
};

export type SaveReportSchedule = {
  name: string;
  siteId?: string | null;
  frequency: 'Daily' | 'Weekly' | 'Monthly';
  timeZoneId: string;
  localHour: number;
  localMinute: number;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  isActive: boolean;
};

export async function listReportSchedulesRequest(token: string) {
  return apiRequest<ReportSchedule[]>('/audit/compliance-report/schedules', {
    method: 'GET',
    token,
  });
}

export async function createReportScheduleRequest(token: string, input: SaveReportSchedule) {
  return apiRequest<ReportSchedule>('/audit/compliance-report/schedules', {
    method: 'POST',
    token,
    body: input,
  });
}

export async function updateReportScheduleRequest(
  token: string,
  scheduleId: string,
  input: SaveReportSchedule,
) {
  return apiRequest<ReportSchedule>(`/audit/compliance-report/schedules/${scheduleId}`, {
    method: 'PUT',
    token,
    body: input,
  });
}

export type ShiftRoster = {
  id: string;
  name: string;
  siteId: string;
  siteName: string;
  timeZoneId: string;
  startLocalTime: string;
  endLocalTime: string;
  daysOfWeek: number[];
  workerIds: string[];
  memberCount: number;
  isActive: boolean;
};

export type SaveShiftRoster = {
  name: string;
  siteId: string;
  timeZoneId: string;
  startLocalTime: string;
  endLocalTime: string;
  daysOfWeek: number[];
  workerIds: string[];
  isActive: boolean;
};

export type ShiftRosterWorkerOption = {
  id: string;
  name: string;
  workerCode?: string | null;
};

export async function listShiftRostersRequest(token: string) {
  return apiRequest<ShiftRoster[]>('/shift-rosters', {
    method: 'GET',
    token,
  });
}

export async function listEligibleShiftRosterWorkersRequest(
  token: string,
  siteId: string,
  search?: string,
) {
  const params = new URLSearchParams({ siteId });
  if (search?.trim()) params.set('search', search.trim());
  return apiRequest<ShiftRosterWorkerOption[]>(`/shift-rosters/eligible-workers?${params}`, {
    method: 'GET',
    token,
  });
}

export async function createShiftRosterRequest(token: string, input: SaveShiftRoster) {
  return apiRequest<ShiftRoster>('/shift-rosters', {
    method: 'POST',
    token,
    body: input,
  });
}

export async function updateShiftRosterRequest(
  token: string,
  rosterId: string,
  input: SaveShiftRoster,
) {
  return apiRequest<ShiftRoster>(`/shift-rosters/${rosterId}`, {
    method: 'PUT',
    token,
    body: input,
  });
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface WorkerTimelineEntry {
  id: string;
  occurredAtUtc: string;
  category: string;
  action: string;
  title: string;
  details?: string | null;
  status?: string | null;
  siteId?: string | null;
  siteName?: string | null;
  sourceType: string;
  sourceId: string;
  actor?: string | null;
}

export interface WorkerTimeline extends PagedResult<WorkerTimelineEntry> {
  workerId: string;
  workerName: string;
  workerCode?: string | null;
  clearanceStatus?: string | null;
}

export async function getWorkerTimeline(
  token: string,
  workerId: string,
  input?: { page?: number; pageSize?: number; category?: string; fromUtc?: string; toUtc?: string },
) {
  const params = new URLSearchParams();
  if (input?.page) params.set('page', String(input.page));
  if (input?.pageSize) params.set('pageSize', String(input.pageSize));
  if (input?.category) params.set('category', input.category);
  if (input?.fromUtc) params.set('fromUtc', input.fromUtc);
  if (input?.toUtc) params.set('toUtc', input.toUtc);
  const query = params.toString();
  return apiRequest<WorkerTimeline>(
    `/workers/${workerId}/timeline${query ? `?${query}` : ''}`,
    { token },
  );
}

export async function downloadWorkerTimeline(
  token: string,
  workerId: string,
  input?: { fromUtc?: string; toUtc?: string },
) {
  const params = new URLSearchParams();
  if (input?.fromUtc) params.set('fromUtc', input.fromUtc);
  if (input?.toUtc) params.set('toUtc', input.toUtc);
  const query = params.toString();
  const response = await fetch(
    `${BACKEND_URL}/workers/${workerId}/timeline.csv${query ? `?${query}` : ''}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok) throw new Error('Worker timeline download failed.');

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `worker-timeline-${workerId}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function listSitesPageRequest(
  token: string,
  input?: { operatorId?: string; page?: number; pageSize?: number },
) {
  const params = new URLSearchParams();
  if (input?.operatorId) params.set('operatorId', input.operatorId);
  if (input?.page) params.set('page', String(input.page));
  if (input?.pageSize) params.set('pageSize', String(input.pageSize));
  const query = params.toString();
  return apiRequest<PagedResult<any>>(`/sites${query ? `?${query}` : ''}`, { token });
}

export async function listSitesRequest(token: string, input?: { operatorId?: string }) {
  const firstPage = await listSitesPageRequest(token, { ...input, page: 1, pageSize: 200 });
  if (!firstPage.hasNextPage) return firstPage.items;

  const remainingPages = await Promise.all(
    Array.from({ length: firstPage.totalPages - 1 }, (_, index) =>
      listSitesPageRequest(token, { ...input, page: index + 2, pageSize: 200 }),
    ),
  );
  return [firstPage, ...remainingPages].flatMap((page) => page.items);
}

export async function createSiteRequest(token: string, input: {
  name: string;
  operatorId: string;
  managerIds?: string[];
  requiredCertificateIds?: string[];
  requiresAccessApproval: boolean;
  usesSecurityCheckpoints: boolean;
  usesSmartAccess: boolean;
  maximumOccupancy?: number;
}) {
  return apiRequest<any>('/sites', {
    method: 'POST',
    token,
    body: input,
  });
}

export async function updateSiteRequest(token: string, siteId: string, input: {
  name?: string;
  operatorId?: string;
  managerIds?: string[];
  requiredCertificateIds?: string[];
  requiresAccessApproval?: boolean;
  usesSecurityCheckpoints?: boolean;
  usesSmartAccess?: boolean;
  maximumOccupancy?: number;
  clearMaximumOccupancy?: boolean;
}) {
  return apiRequest<any>(`/sites/${siteId}`, {
    method: 'PUT',
    token,
    body: input,
  });
}

export async function deleteSiteRequest(token: string, siteId: string) {
  return apiRequest<void>(`/sites/${siteId}`, {
    method: 'DELETE',
    token,
  });
}

export interface SiteSmartAccess {
  siteId: string;
  hasSmartAccessConfigured: boolean;
  providers: { id: string; name: string; integrationKey: string }[];
  entrances: {
    id: string;
    name: string;
    accessPointType: number;
    supportsEntry: boolean;
    supportsExit: boolean;
    isActive: boolean;
    locks: { id: string; name: string; model: string; externalDeviceId?: string }[];
  }[];
  unassignedDevices: { id: string; name: string; model: string; externalDeviceId?: string }[];
}

export async function getSiteSmartAccessRequest(token: string, siteId: string) {
  return apiRequest<SiteSmartAccess>(`/sites/${siteId}/smart-access`, { token });
}

export async function createSiteEntranceRequest(token: string, siteId: string, input: {
  name: string;
  accessPointType?: number;
  supportsEntry?: boolean;
  supportsExit?: boolean;
}) {
  return apiRequest<any>(`/sites/${siteId}/entrances`, { method: 'POST', token, body: input });
}

export async function assignDeviceToSiteRequest(token: string, siteId: string, input: {
  deviceId: string;
  entranceId?: string | null;
}) {
  return apiRequest<any>(`/sites/${siteId}/assign-device`, { method: 'POST', token, body: input });
}

export async function provisionSiteCredentialsRequest(token: string, siteId: string) {
  return apiRequest<{ approvedRequests: number; provisioned: number; failed: number }>(
    `/sites/${siteId}/provision-credentials`, { method: 'POST', token });
}

export async function listOperatorsRequest(token: string) {
  return apiRequest<any[]>('/companies/operators', { token });
}

export async function getOperatorDetailRequest(token: string, operatorId: string) {
  return apiRequest<OperatorDetail>(`/companies/operators/${operatorId}`, { token });
}

export async function listContractorsRequest(token: string) {
  return apiRequest<any[]>('/companies/contractors', { token });
}

export async function listExternalCompaniesRequest(token: string) {
  return apiRequest<any[]>('/companies/external', { token });
}

export async function getContractorDetailRequest(token: string, contractorId: string) {
  return apiRequest<ContractorDetail>(`/companies/contractors/${contractorId}`, { token });
}

export async function createOperatorRequest(token: string, input: { name: string }) {
  return apiRequest<any>('/companies/operators', {
    method: 'POST',
    token,
    body: input,
  });
}

export async function updateOperatorRequest(token: string, operatorId: string, input: { name: string }) {
  return apiRequest<any>(`/companies/operators/${operatorId}`, {
    method: 'PUT',
    token,
    body: input,
  });
}

export async function deleteOperatorRequest(token: string, operatorId: string) {
  return apiRequest<void>(`/companies/operators/${operatorId}`, {
    method: 'DELETE',
    token,
  });
}

export async function createContractorRequest(token: string, input: { name: string }) {
  return apiRequest<any>('/companies/contractors', {
    method: 'POST',
    token,
    body: input,
  });
}

export async function createExternalCompanyRequest(token: string, input: {
  name: string;
  companyType: number;
  operatorId?: string;
  contractNumber?: string;
  contractValidFromUtc?: string;
  contractValidToUtc?: string;
  adminName: string;
  adminEmail: string;
}) {
  return apiRequest<any>('/companies/external', { method: 'POST', token, body: input });
}

export async function updateContractorRequest(token: string, contractorId: string, input: { name: string }) {
  return apiRequest<any>(`/companies/contractors/${contractorId}`, {
    method: 'PUT',
    token,
    body: input,
  });
}

export async function updateExternalCompanyRequest(token: string, companyId: string, input: { name: string; companyType: number }) {
  return apiRequest<any>(`/companies/external/${companyId}`, { method: 'PUT', token, body: input });
}

export async function deleteContractorRequest(token: string, contractorId: string) {
  return apiRequest<void>(`/companies/contractors/${contractorId}`, {
    method: 'DELETE',
    token,
  });
}

export async function deleteExternalCompanyRequest(token: string, companyId: string) {
  return apiRequest<void>(`/companies/external/${companyId}`, { method: 'DELETE', token });
}

export async function listJobPositionsRequest(token: string) {
  return apiRequest<import('./types').JobPosition[]>('/compliance/job-positions', { token });
}

export async function createJobPositionRequest(token: string, input: {
  name: string;
  description?: string | null;
  credentialRequirements: Array<{ certificateTypeId: string; minimumValidityDays: number }>;
}) {
  return apiRequest<import('./types').JobPosition>('/compliance/job-positions', { method: 'POST', token, body: input });
}

export async function updateJobPositionRequest(token: string, id: string, input: {
  name?: string;
  description?: string | null;
  isActive?: boolean;
  credentialRequirements?: Array<{ certificateTypeId: string; minimumValidityDays: number }>;
}) {
  return apiRequest<import('./types').JobPosition>(`/compliance/job-positions/${id}`, { method: 'PUT', token, body: input });
}

export async function assessWorkerPositionRequest(token: string, userId: string) {
  return apiRequest<import('./types').WorkerPositionCompliance>(`/compliance/job-positions/workers/${userId}/assessment`, { token });
}

export async function listProjectRolesRequest(token: string) {
  return apiRequest<import('./types').ProjectRole[]>('/projects/roles', { token });
}

export type ProjectMembershipSummary = {
  id: string;
  name: string;
  status: string;
  operatorId: string;
  operatorName: string;
  validFromUtc: string;
  validToUtc: string;
};

export async function listProjectsForMemberRequest(token: string, memberId: string, operatorId?: string) {
  const query = operatorId ? `?operatorId=${encodeURIComponent(operatorId)}` : '';
  return apiRequest<ProjectMembershipSummary[]>(`/projects/for-member/${memberId}${query}`, { token });
}

export async function createProjectRoleRequest(token: string, input: {
  name: string;
  grantsFullProjectAccess: boolean;
  isSecondSignatory: boolean;
  canManageCrew: boolean;
  dutyKeys: string[];
}) {
  return apiRequest<import('./types').ProjectRole>('/projects/roles', { method: 'POST', token, body: input });
}

export async function updateProjectRoleRequest(token: string, id: string, input: {
  name?: string;
  grantsFullProjectAccess?: boolean;
  isSecondSignatory?: boolean;
  canManageCrew?: boolean;
  dutyKeys?: string[];
}) {
  return apiRequest<import('./types').ProjectRole>(`/projects/roles/${id}`, { method: 'PUT', token, body: input });
}

export async function listTenantsRequest(token: string, input?: { includeInactive?: boolean }) {
  const params = new URLSearchParams();
  if (input?.includeInactive) params.set('includeInactive', 'true');
  const query = params.toString();
  return apiRequest<Tenant[]>(`/platform/tenants${query ? `?${query}` : ''}`, { token });
}

export async function getAccessRulesRequest(token: string, tenantId: string) {
  return apiRequest<AccessRuleConfig>(`/platform/tenants/${tenantId}/access-rules`, { token });
}

export async function updateAccessRulesRequest(
  token: string,
  tenantId: string,
  input: { certificateExpiryGraceDays: number; toleratedReasons: number[] }
) {
  return apiRequest<AccessRuleConfig>(`/platform/tenants/${tenantId}/access-rules`, {
    method: 'PUT',
    token,
    body: input,
  });
}

export async function listAccessRuleOptionsRequest(token: string) {
  return apiRequest<DecisionReasonOption[]>('/platform/access-rules/options', { token });
}

export async function evaluateAccessDecisionRequest(
  token: string,
  tenantId: string,
  input: { userId: string; siteId: string; evaluatedAtUtc?: string }
) {
  return apiRequest<AccessDecisionEvaluation>(`/platform/tenants/${tenantId}/access-rules/evaluate`, {
    method: 'POST',
    token,
    body: input,
  });
}

export async function listUsersRequest(token: string, input?: { role?: string; operatorId?: string; contractorId?: string; page?: number; pageSize?: number }) {
  const params = new URLSearchParams();
  if (input?.role) params.set('role', input.role);
  if (input?.operatorId) params.set('operatorId', input.operatorId);
  if (input?.contractorId) params.set('contractorId', input.contractorId);
  if (input?.page) params.set('page', String(input.page));
  if (input?.pageSize) params.set('pageSize', String(input.pageSize));
  const query = params.toString();
  const users = await apiRequest<Array<User & { identityNumber?: string | null; employerName?: string | null }>>(`/users${query ? `?${query}` : ''}`, { token });
  return users.map(normalizeUserProfile);
}

export async function getUserByIdRequest(token: string, id: string) {
  const user = await apiRequest<User & { identityNumber?: string | null; employerName?: string | null }>(`/users/${id}`, { token });
  return normalizeUserProfile(user);
}

export async function listAccessRequestsPageRequest(
  token: string,
  input?: {
    status?: string;
    siteId?: string;
    supervisorId?: string;
    workerId?: string;
    page?: number;
    pageSize?: number;
  },
) {
  const params = new URLSearchParams();
  if (input?.status) params.set('status', input.status);
  if (input?.siteId) params.set('siteId', input.siteId);
  if (input?.supervisorId) params.set('supervisorId', input.supervisorId);
  if (input?.workerId) params.set('workerId', input.workerId);
  if (input?.page) params.set('page', String(input.page));
  if (input?.pageSize) params.set('pageSize', String(input.pageSize));
  const query = params.toString();
  return apiRequest<PagedResult<AccessRequest>>(`/access-requests${query ? `?${query}` : ''}`, { token });
}

export async function listAccessRequestsRequest(
  token: string,
  input?: { status?: string; siteId?: string; supervisorId?: string; workerId?: string },
) {
  const firstPage = await listAccessRequestsPageRequest(token, { ...input, page: 1, pageSize: 200 });
  if (!firstPage.hasNextPage) return firstPage.items;

  const remainingPages = await Promise.all(
    Array.from({ length: firstPage.totalPages - 1 }, (_, index) =>
      listAccessRequestsPageRequest(token, { ...input, page: index + 2, pageSize: 200 }),
    ),
  );
  return [firstPage, ...remainingPages].flatMap((page) => page.items);
}

export async function listGateActivityRequest(token: string) {
  const rows = await apiRequest<any[]>('/gate/activity', { token });
  return rows.map(normalizeGateActivity);
}

export async function listGateActivityFilteredRequest(
  token: string,
  input?: { userId?: string; siteId?: string; limit?: number }
) {
  const params = new URLSearchParams();
  if (input?.userId) params.set('userId', input.userId);
  if (input?.siteId) params.set('siteId', input.siteId);
  if (input?.limit) params.set('limit', String(input.limit));
  const query = params.toString();
  const rows = await apiRequest<any[]>(`/gate/activity${query ? `?${query}` : ''}`, { token });
  return rows.map(normalizeGateActivity);
}

export async function createGateActivityRequest(token: string, input: {
  userId: string;
  siteId: string;
  gate: string;
  type: 'CheckIn' | 'CheckOut';
}) {
  const row = await apiRequest<any>('/gate/activity', {
    method: 'POST',
    token,
    body: input,
  });
  return normalizeGateActivity(row);
}

function normalizeGateActivity(row: any) {
  return {
    ...row,
    timestamp: row.timestamp ?? row.occurredAtUtc,
    type: row.type ?? row.activityType,
    gate: row.gate ?? row.gateName,
  };
}

export async function listCertificateTypesRequest(token: string) {
  return apiRequest<any[]>('/certificates', { token });
}

export async function createCertificateTypeRequest(token: string, input: { name: string }) {
  return apiRequest<any>('/certificates', {
    method: 'POST',
    token,
    body: input,
  });
}

export async function updateCertificateTypeRequest(token: string, certificateId: string, input: { name: string }) {
  return apiRequest<any>(`/certificates/${certificateId}`, {
    method: 'PUT',
    token,
    body: input,
  });
}

export async function deleteCertificateTypeRequest(token: string, certificateId: string) {
  return apiRequest<void>(`/certificates/${certificateId}`, {
    method: 'DELETE',
    token,
  });
}

export type CreateUserInput = {
  name: string;
  email?: string | null;
  role: string;
  status?: string;
  operatorId?: string;
  contractorId?: string;
  assignedSiteId?: string;
  nationality?: string;
  company?: string;
  workerCode?: string;
  idNumber?: string;
  notes?: string;
  certificates?: { certificateTypeId: string; expiresAtUtc?: string | null }[];
  sendWelcomeEmail?: boolean;
  interactiveAccountEnabled?: boolean;
  preferredName?: string;
  nameInOriginalScript?: string;
  phoneticName?: string;
  preferredLanguage?: string;
  secondaryLanguages?: string[];
  preferredInteractionMode?: 'Web' | 'MobileApp' | 'PrintedCard' | 'Kiosk' | 'Sms' | 'SupervisorAssisted' | null;
  needsAssistedWorkflow?: boolean;
  personalDeviceAvailable?: boolean;
  canReceiveSms?: boolean;
  offlineCardRequired?: boolean;
  audioInstructionsPreferred?: boolean;
  largeTextPreferred?: boolean;
  interpreterRequired?: boolean;
  accessibilitySupportNotes?: string;
  registrationChannel?: 'SelfService' | 'Assisted' | 'BulkImport' | 'Kiosk' | 'Integration' | null;
  assistedByUserId?: string;
  employment?: {
    contractorId?: string;
    operatorId?: string;
    employeeNumber?: string;
    trade?: string;
    jobPositionId?: string;
    department?: string;
    supervisorUserId?: string;
    employmentType: string;
    validFromUtc: string;
    validToUtc?: string;
  };
};

function toCreateUserRequestBody(input: CreateUserInput) {
  const { company, idNumber, ...rest } = input;
  return {
    ...rest,
    employerName: company,
    identityNumber: idNumber,
  };
}

export async function createUserRequest(token: string, input: CreateUserInput) {
  const user = await apiRequest<User>('/users', {
    method: 'POST',
    token,
    body: toCreateUserRequestBody(input),
  });
  return { user: normalizeUserProfile(user) };
}

export type BulkRegistrationResult = {
  total: number;
  valid: number;
  invalid: number;
  created: number;
  dryRun: boolean;
  results: {
    rowNumber: number;
    isValid: boolean;
    userId?: string | null;
    errors: string[];
  }[];
};

export type RegistrationFieldDefinition = {
  id: string;
  key: string;
  label: string;
  helpText?: string | null;
  labels: Record<string, string>;
  fieldType: 'Text' | 'LongText' | 'Number' | 'Boolean' | 'Date' | 'DateTime' | 'Choice' | 'MultiChoice' | 'Phone' | 'Email';
  required: boolean;
  sensitive: boolean;
  options: string[];
  displayOrder: number;
};

export type RegistrationProfile = {
  id: string;
  code: string;
  name: string;
  entityType: string;
  version: number;
  description?: string | null;
  supportsAssistedRegistration: boolean;
  supportsDeviceLessRegistration: boolean;
  fields: RegistrationFieldDefinition[];
};

export async function listRegistrationProfilesRequest(token: string, entityType: string) {
  return apiRequest<RegistrationProfile[]>(
    `/registration/profiles?entityType=${encodeURIComponent(entityType)}`,
    { token },
  );
}

export async function saveRegistrationValuesRequest(
  token: string,
  entityType: string,
  entityId: string,
  registrationProfileId: string,
  values: Record<string, unknown>,
) {
  return apiRequest(`/registration/values/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`, {
    method: 'PUT',
    token,
    body: { registrationProfileId, values },
  });
}

export async function bulkRegisterUsersRequest(token: string, input: {
  idempotencyKey: string;
  dryRun: boolean;
  users: CreateUserInput[];
}) {
  return apiRequest<BulkRegistrationResult>('/users/bulk', {
    method: 'POST',
    token,
    body: {
      ...input,
      users: input.users.map(toCreateUserRequestBody),
    },
  });
}

export type UpdateUserInput = {
  name?: string;
  email?: string | null;
  role?: string;
  status?: string;
  assignedSiteId?: string | null;
  contractorId?: string | null;
  operatorId?: string | null;
  nationality?: string | null;
  company?: string | null;
  idNumber?: string | null;
  notes?: string | null;
  certificates?: { certificateTypeId: string; expiresAtUtc?: string | null }[];
  password?: string;
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
  accessibilitySupportNotes?: string | null;
  registrationChannel?: 'SelfService' | 'Assisted' | 'BulkImport' | 'Kiosk' | 'Integration' | null;
  employment?: CreateUserInput['employment'] | null;
};

export async function updateUserRequest(token: string, userId: string, input: UpdateUserInput) {
  const { company, idNumber, password, ...rest } = input;
  const user = await apiRequest<User & { identityNumber?: string | null; employerName?: string | null }>(`/users/${userId}`, {
    method: 'PUT',
    token,
    body: {
      ...rest,
      employerName: company,
      identityNumber: idNumber,
      newPassword: password,
    },
  });
  return normalizeUserProfile(user);
}

export async function deleteUserRequest(token: string, userId: string) {
  return apiRequest<void>(`/users/${userId}`, {
    method: 'DELETE',
    token,
  });
}

export async function createAccessRequest(token: string, input: {
  supervisorId?: string;
  contractorId?: string;
  siteId: string;
  contractNumber: string;
  focalPoint: string;
  notes?: string;
  workerIds: string[];
}) {
  return apiRequest<AccessRequest>('/access-requests', {
    method: 'POST',
    token,
    body: input,
  });
}

export async function updateAccessRequest(token: string, requestId: string, input: {
  status?: string;
  validFromUtc?: string;
  expiresAtUtc?: string;
  isPermanent?: boolean;
  notes?: string;
  // Required by the backend when denying — recorded on the request's audit trail.
  decisionReason?: string;
}) {
  return apiRequest<AccessRequest>(`/access-requests/${requestId}`, {
    method: 'PATCH',
    token,
    body: input,
  });
}

export async function deleteAccessRequest(token: string, requestId: string) {
  return apiRequest<void>(`/access-requests/${requestId}`, {
    method: 'DELETE',
    token,
  });
}

export async function fetchWorkerRequest(token: string, workerId: string) {
  return apiRequest<WorkerProfile>(`/workers/${workerId}`, { token });
}

export type WorkerClearance = {
  workerId: string;
  status: 'Pending' | 'Submitted' | 'UnderReview' | 'Cleared' | 'Returned';
  clearedByUserId?: string | null;
  clearanceUpdatedAtUtc?: string | null;
  clearanceNote?: string | null;
};

export type WorkerClearanceAction = 'submit' | 'start-review' | 'clear' | 'return';

export async function transitionWorkerClearance(
  token: string,
  workerId: string,
  action: WorkerClearanceAction,
  note?: string,
) {
  const body = action === 'clear' || action === 'return' ? { note } : undefined;
  return apiRequest<WorkerClearance>(`/workers/${workerId}/clearance/${action}`, {
    method: 'POST',
    token,
    body,
  });
}

export type WorkerDocument = {
  id: string;
  workerId: string;
  documentType: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  certificateTypeId?: string | null;
  uploadedByUserId?: string | null;
  uploadedAtUtc: string;
  reviewStatus: 'Pending' | 'Verified' | 'Rejected';
  reviewedByUserId?: string | null;
  reviewedAtUtc?: string | null;
  reviewNote?: string | null;
};

export async function reviewWorkerDocument(
  token: string,
  documentId: string,
  decision: 'Verified' | 'Rejected',
  note?: string,
) {
  return apiRequest<WorkerDocument>(`/documents/${documentId}/review`, {
    method: 'POST',
    token,
    body: { decision, note },
  });
}

// Multipart upload — apiRequest JSON-encodes, so this uses fetch directly with FormData (the browser sets the
// multipart boundary; we must NOT set Content-Type ourselves).
export async function uploadWorkerDocument(
  token: string,
  workerId: string,
  file: File,
  documentType: string,
  certificateTypeId?: string
) {
  const form = new FormData();
  form.append('file', file);
  form.append('documentType', documentType);
  if (certificateTypeId) form.append('certificateTypeId', certificateTypeId);
  const response = await fetch(`${BACKEND_URL}/workers/${workerId}/documents`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!response.ok) throw new Error('Document upload failed.');
  return (await response.json()) as WorkerDocument;
}

export async function listWorkerDocuments(token: string, workerId: string) {
  return apiRequest<WorkerDocument[]>(`/workers/${workerId}/documents`, { token });
}

export async function downloadWorkerDocument(token: string, documentId: string, fileName: string) {
  const response = await fetch(`${BACKEND_URL}/documents/${documentId}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Document download failed.');
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function deleteWorkerDocument(token: string, documentId: string) {
  return apiRequest<void>(`/documents/${documentId}`, { method: 'DELETE', token });
}

export async function getWorkerDocumentDataUrl(token: string, documentId: string) {
  const response = await fetch(`${BACKEND_URL}/documents/${documentId}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Worker photo download failed.');
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export type WorkerCard = {
  id: string;
  cardNumber: string;
  workerId: string;
  workerCode: string;
  workerName: string;
  employerName: string;
  jobTitle: string;
  role: string;
  status: 'Issued' | 'Printed' | 'Replaced' | 'Revoked' | 'Expired';
  isValid: boolean;
  credential: string;
  photoDocumentId?: string | null;
  photoCropX: number;
  photoCropY: number;
  photoZoom: number;
  issuedAtUtc: string;
  expiresAtUtc?: string | null;
  printedAtUtc?: string | null;
  revokedAtUtc?: string | null;
  revocationReason?: string | null;
};

export async function listWorkerCards(token: string, workerId: string) {
  return apiRequest<WorkerCard[]>(`/workers/${workerId}/cards`, { token });
}

export async function searchWorkerCards(
  token: string,
  input: { search?: string; page?: number; pageSize?: number; includeInactive?: boolean } = {},
) {
  const params = new URLSearchParams();
  if (input.search?.trim()) params.set('search', input.search.trim());
  params.set('page', String(input.page ?? 1));
  params.set('pageSize', String(input.pageSize ?? 25));
  if (input.includeInactive) params.set('includeInactive', 'true');
  return apiRequest<PagedResult<WorkerCard>>(`/worker-cards?${params}`, { token });
}

export async function issueWorkerCard(
  token: string,
  workerId: string,
  input: {
    photoDocumentId?: string;
    expiresAtUtc?: string;
    photoCropX?: number;
    photoCropY?: number;
    photoZoom?: number;
  },
) {
  return apiRequest<WorkerCard>(`/workers/${workerId}/cards`, {
    method: 'POST',
    token,
    body: input,
  });
}

export async function markWorkerCardPrinted(token: string, cardId: string) {
  return apiRequest<WorkerCard>(`/worker-cards/${cardId}/printed`, {
    method: 'POST',
    token,
  });
}

export async function markWorkerCardsPrinted(token: string, cardIds: string[]) {
  return apiRequest<WorkerCard[]>('/worker-cards/printed-batch', {
    method: 'POST',
    token,
    body: { cardIds },
  });
}

export type WorkerCardBranding = {
  companyName: string;
  cardLabel: string;
  primaryColor: string;
  secondaryColor: string;
  footerText: string;
  logoUrl?: string | null;
};

export async function getWorkerCardBranding(token: string) {
  return apiRequest<WorkerCardBranding>('/worker-cards/branding', { token });
}

export type WorkerCardValidation = {
  isValid: boolean;
  reason: string;
  card?: WorkerCard | null;
};

export async function validateWorkerCard(token: string, credential: string) {
  return apiRequest<WorkerCardValidation>('/worker-cards/validate', {
    method: 'POST',
    token,
    body: { credential },
  });
}

export type WorkerCardOfflineManifest = {
  schemaVersion: 1;
  version: string;
  purpose: 'IdentityOnly';
  authorizationRequiresOnline: true;
  generatedAtUtc: string;
  expiresAtUtc: string;
  site: {
    id: string;
    name: string;
    requiresAccessApproval: boolean;
    usesSecurityCheckpoints: boolean;
    usesSmartAccess: boolean;
  };
  entries: Array<{
    credentialHash: string;
    cardNumber: string;
    workerId: string;
    workerCode: string;
    workerName: string;
    employerName: string;
    jobTitle: string;
    role: string;
    expiresAtUtc?: string | null;
  }>;
};

export async function getWorkerCardOfflineManifest(token: string, siteId: string) {
  return apiRequest<WorkerCardOfflineManifest>(
    `/worker-cards/offline-manifest?siteId=${encodeURIComponent(siteId)}`,
    { token },
  );
}

export async function revokeWorkerCard(token: string, cardId: string, reason: string) {
  return apiRequest<WorkerCard>(`/worker-cards/${cardId}/revoke`, {
    method: 'POST',
    token,
    body: { reason },
  });
}

export async function replaceWorkerCard(
  token: string,
  cardId: string,
  input: {
    photoDocumentId?: string;
    expiresAtUtc?: string;
    photoCropX?: number;
    photoCropY?: number;
    photoZoom?: number;
  },
) {
  return apiRequest<WorkerCard>(`/worker-cards/${cardId}/replace`, {
    method: 'POST',
    token,
    body: input,
  });
}

export type QrCredentialResponse = {
  token: string;
  expiresAt: string;
  expiresInSeconds: number;
};

export async function fetchQrCredential(authToken: string, siteId?: string) {
  const query = siteId ? `?siteId=${encodeURIComponent(siteId)}` : '';
  return apiRequest<QrCredentialResponse>(`/auth/qr-credential${query}`, {
    method: 'POST',
    token: authToken,
  });
}

export type PermitToWork = {
  id: string;
  permitNumber: string;
  workerId: string;
  workerName: string;
  siteId: string;
  siteName: string;
  issuedByUserId: string;
  issuedByUserName: string;
  accessRequestId?: string | null;
  workDescription?: string | null;
  status: 'Active' | 'Expired' | 'Cancelled' | 'Completed' | string;
  validFromUtc: string;
  validToUtc: string;
  createdAtUtc: string;
};

export async function fetchPermits(
  authToken: string,
  params?: { siteId?: string; workerId?: string; activeOnly?: boolean }
) {
  const qs = new URLSearchParams();
  if (params?.siteId) qs.set('siteId', params.siteId);
  if (params?.workerId) qs.set('workerId', params.workerId);
  if (params?.activeOnly) qs.set('activeOnly', 'true');
  const query = qs.toString() ? `?${qs}` : '';
  return apiRequest<PermitToWork[]>(`/permits${query}`, { token: authToken });
}

export async function issuePermit(
  authToken: string,
  body: {
    projectId?: string;
    workerId: string;
    siteId: string;
    accessRequestId?: string;
    workDescription?: string;
    validFromUtc: string;
    validToUtc: string;
  }
) {
  return apiRequest<PermitToWork>('/permits', { method: 'POST', token: authToken, body });
}

export async function cancelPermit(authToken: string, permitId: string, reason: string) {
  return apiRequest<PermitToWork>(`/permits/${permitId}/cancel`, {
    method: 'POST',
    token: authToken,
    body: { reason },
  });
}

export async function completePermit(authToken: string, permitId: string) {
  return apiRequest<PermitToWork>(`/permits/${permitId}/complete`, {
    method: 'POST',
    token: authToken,
  });
}

export type SiteAlert = {
  id: string;
  siteId: string;
  siteName: string;
  eventType: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical' | string;
  description: string;
  triggeredByUserId?: string | null;
  triggeredByUserName?: string | null;
  deviceId?: string | null;
  isAcknowledged: boolean;
  acknowledgedByUserId?: string | null;
  acknowledgedByUserName?: string | null;
  acknowledgedAtUtc?: string | null;
  acknowledgementNote?: string | null;
  occurredAtUtc: string;
};

export type UserNotification = {
  id: string;
  category: string;
  title: string;
  message: string;
  link?: string | null;
  isRead: boolean;
  createdAtUtc: string;
  readAtUtc?: string | null;
};

export function fetchUserNotifications(authToken: string, unreadOnly = false) {
  return apiRequest<UserNotification[]>(`/notifications?unreadOnly=${unreadOnly}`, { token: authToken });
}

export function markUserNotificationRead(authToken: string, notificationId: string) {
  return apiRequest<UserNotification>(`/notifications/${notificationId}/read`, { method: 'POST', token: authToken });
}

export async function fetchAlerts(
  authToken: string,
  params?: { siteId?: string; unacknowledgedOnly?: boolean }
) {
  const qs = new URLSearchParams();
  if (params?.siteId) qs.set('siteId', params.siteId);
  if (params?.unacknowledgedOnly) qs.set('unacknowledgedOnly', 'true');
  const query = qs.toString() ? `?${qs}` : '';
  return apiRequest<SiteAlert[]>(`/alerts${query}`, { token: authToken });
}

export async function acknowledgeAlert(authToken: string, alertId: string, note?: string) {
  return apiRequest<SiteAlert>(`/alerts/${alertId}/acknowledge`, {
    method: 'POST',
    token: authToken,
    body: { note },
  });
}

export type AuditLogEntry = {
  id: string;
  actorUserId?: string | null;
  actorRole?: string | null;
  actionType: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  clientIp?: string | null;
  occurredAtUtc: string;
};

export async function fetchAuditLog(
  authToken: string,
  params?: { entityType?: string; entityId?: string; actorUserId?: string; take?: number; page?: number }
) {
  const qs = new URLSearchParams();
  if (params?.entityType) qs.set('entityType', params.entityType);
  if (params?.entityId) qs.set('entityId', params.entityId);
  if (params?.actorUserId) qs.set('actorUserId', params.actorUserId);
  if (params?.take) qs.set('take', String(params.take));
  if (params?.page) qs.set('page', String(params.page));
  const query = qs.toString() ? `?${qs}` : '';
  return apiRequest<AuditLogEntry[]>(`/audit${query}`, { token: authToken });
}

type ReportExport = {
  id: string;
  status: 'Pending' | 'Processing' | 'Completed' | 'Failed';
  fileName: string;
  error?: string | null;
  canDownload: boolean;
};

// Creates a durable background export, polls its small status record, then downloads the completed object.
export async function downloadComplianceCsv(authToken: string, params?: { asOf?: string; siteId?: string }) {
  const job = await apiRequest<ReportExport>('/audit/compliance-report/exports', {
    method: 'POST',
    token: authToken,
    body: { asOfUtc: params?.asOf, siteId: params?.siteId },
  });

  let completed = job;
  for (let attempt = 0; attempt < 90 && !completed.canDownload; attempt += 1) {
    if (completed.status === 'Failed') throw new Error(completed.error || 'Compliance export failed.');
    await new Promise(resolve => window.setTimeout(resolve, 1000));
    completed = await apiRequest<ReportExport>(`/audit/compliance-report/exports/${job.id}`, {
      token: authToken,
    });
  }
  if (!completed.canDownload) throw new Error('The compliance export is still processing. Try again shortly.');

  const response = await fetch(`${BACKEND_URL}/audit/compliance-report/exports/${job.id}/download`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (!response.ok) throw new Error('Failed to download compliance report.');
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = completed.fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
