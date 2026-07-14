import type { AccessDecisionEvaluation, AccessRequest, AccessRuleConfig, ContractorDetail, DecisionReasonOption, OperatorDetail, Tenant, User, WorkerProfile } from './types';

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

export async function apiRequest<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const { method = 'GET', body, token, withCredentials } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${BACKEND_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: withCredentials ? 'include' : 'same-origin',
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    // Transparently recover from an expired access token: perform one shared silent refresh, then retry once.
    // Auth endpoints are excluded (they manage tokens themselves) and isRetry guards against loops.
    if (response.status === 401 && token && !isRetry && !path.startsWith('/auth') && sessionBridge) {
      const refreshedToken = await sessionBridge.refresh();
      if (refreshedToken && refreshedToken !== token) {
        return apiRequest<T>(path, { ...options, token: refreshedToken }, true);
      }
    }
    const message = data?.error || 'Request failed';
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

export async function loginRequest(input: { email: string; password: string }) {
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
  return apiRequest<User>('/users/me', {
    method: 'GET',
    token,
  });
}

export async function fetchDashboardSummaryRequest(
  token: string,
  input?: { operatorId?: string; siteId?: string }
) {
  const params = new URLSearchParams();
  if (input?.operatorId && input.operatorId !== 'all') params.set('operatorId', input.operatorId);
  if (input?.siteId && input.siteId !== 'all') params.set('siteId', input.siteId);
  const query = params.toString();
  return apiRequest<DashboardSummary>(`/dashboard/summary${query ? `?${query}` : ''}`, { token });
}

export async function listSitesRequest(token: string, input?: { operatorId?: string }) {
  const params = new URLSearchParams();
  if (input?.operatorId) params.set('operatorId', input.operatorId);
  const query = params.toString();
  return apiRequest<any[]>(`/sites${query ? `?${query}` : ''}`, { token });
}

export async function createSiteRequest(token: string, input: {
  name: string;
  operatorId: string;
  managerIds?: string[];
  requiredCertificateIds?: string[];
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

export async function updateContractorRequest(token: string, contractorId: string, input: { name: string }) {
  return apiRequest<any>(`/companies/contractors/${contractorId}`, {
    method: 'PUT',
    token,
    body: input,
  });
}

export async function deleteContractorRequest(token: string, contractorId: string) {
  return apiRequest<void>(`/companies/contractors/${contractorId}`, {
    method: 'DELETE',
    token,
  });
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

export async function listUsersRequest(token: string, input?: { role?: string; operatorId?: string; contractorId?: string }) {
  const params = new URLSearchParams();
  if (input?.role) params.set('role', input.role);
  if (input?.operatorId) params.set('operatorId', input.operatorId);
  if (input?.contractorId) params.set('contractorId', input.contractorId);
  const query = params.toString();
  return apiRequest<any[]>(`/users${query ? `?${query}` : ''}`, { token });
}

export async function listAccessRequestsRequest(token: string, input?: { status?: string; siteId?: string; supervisorId?: string; workerId?: string }) {
  const params = new URLSearchParams();
  if (input?.status) params.set('status', input.status);
  if (input?.siteId) params.set('siteId', input.siteId);
  if (input?.supervisorId) params.set('supervisorId', input.supervisorId);
  if (input?.workerId) params.set('workerId', input.workerId);
  const query = params.toString();
  return apiRequest<AccessRequest[]>(`/access-requests${query ? `?${query}` : ''}`, { token });
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

export async function fetchScanStatusRequest(token: string, userId: string, siteId: string) {
  const params = new URLSearchParams({ siteId });
  const status = await apiRequest<any>(`/scan/${userId}/status?${params.toString()}`, { token });
  return mapScanStatus(status);
}

// Resolve a scanned LIVE QR credential token (the "live, not static" badge) to its worker and live verdict in one call.
export async function fetchScanByTokenRequest(token: string, qrToken: string, siteId: string) {
  const status = await apiRequest<any>(`/scan/resolve`, {
    method: 'POST',
    token,
    body: { token: qrToken, siteId },
  });
  return mapScanStatus(status);
}

function mapScanStatus(status: any) {
  if (status.user) return status;

  const accessStatus = status.hasApprovedAccess
    ? 'approved'
    : status.decisionReasonCode === 'AccessWindowExpired'
      ? 'denied-expired'
      : status.decisionReasonCode === 'AccessWindowNotStarted'
        ? 'denied-not-started'
        : 'denied-no-request';

  return {
    ...status,
    user: {
      id: status.userId,
      name: status.name,
      role: status.role,
      status: status.workerProfile?.isActive === false ? 'Inactive' : 'Active',
      company: status.workerProfile?.employerName ?? null,
      nationality: status.workerProfile?.nationality ?? null,
      idNumber: status.workerProfile?.identityNumber ?? status.workerCode ?? null,
      presence: {
        status: status.presenceStatus,
        lastActivityType: status.lastActivityType,
        lastGate: status.latestGateActivity?.gateName ?? null,
        lastSiteId: status.currentSiteId,
        lastSeenAt: status.lastSeenAtUtc,
      },
    },
    site: {
      id: status.siteId,
      name: status.siteName,
      requiredCertificates: [],
    },
    certificateStatus: {
      missing: status.missingCertificates ?? [],
      expired: [],
    },
    accessStatus,
    accessRequest: status.accessRequestId
      ? {
          id: status.accessRequestId,
          status: status.accessRequestStatus,
        }
      : null,
    lastActivity: status.lastActivityType ?? status.latestGateActivity?.activityType ?? null,
    smartLockEnforced: Boolean(status.hasSmartLockEnforcement),
    scanRequired: status.scanRequired !== false,
    accessEnforcementMode: status.accessEnforcementMode,
    accessEnforcementMessage: status.accessEnforcementMessage,
    mobileAppCheckInRequired: Boolean(status.mobileAppCheckInRequired),
    canCheckIn: Boolean(status.canCheckIn),
    canCheckOut: Boolean(status.canCheckOut),
    failureReason: status.failureReason ?? null,
  };
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

export async function createUserRequest(token: string, input: {
  name: string;
  email?: string;
  role: string;
  status?: string;
  operatorId?: string;
  contractorId?: string;
  assignedSiteId?: string;
  nationality?: string;
  company?: string;
  idNumber?: string;
  notes?: string;
  certificates?: { name: string; expiryDate?: string }[];
  sendWelcomeEmail?: boolean;
}) {
  return apiRequest<{ user: User; tempPassword?: string; emailSent?: boolean }>(
    '/users',
    {
      method: 'POST',
      token,
      body: input,
    }
  );
}

export async function updateUserRequest(token: string, userId: string, input: {
  name?: string;
  email?: string;
  role?: string;
  status?: string;
  assignedSiteId?: string | null;
  contractorId?: string | null;
  operatorId?: string | null;
  nationality?: string | null;
  company?: string | null;
  idNumber?: string | null;
  notes?: string | null;
  certificates?: { name: string; expiryDate?: string }[];
  password?: string;
}) {
  return apiRequest<User>(`/users/${userId}`, {
    method: 'PUT',
    token,
    body: input,
  });
}

export async function deleteUserRequest(token: string, userId: string) {
  return apiRequest<void>(`/users/${userId}`, {
    method: 'DELETE',
    token,
  });
}

export async function createAccessRequest(token: string, input: {
  supervisorId: string;
  operatorId: string;
  contractorId: string;
  siteId: string;
  contractNumber: string;
  focalPoint: string;
  notes?: string;
  workerList: Array<{
    id: string;
    name: string;
    email: string;
    nationality?: string;
    certificates?: { name: string; expiryDate?: string }[];
  }>;
}) {
  return apiRequest<AccessRequest>('/access-requests', {
    method: 'POST',
    token,
    body: input,
  });
}

export async function updateAccessRequest(token: string, requestId: string, input: {
  status?: string;
  validFrom?: string;
  expiresAt?: string;
  permanent?: boolean;
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
};

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
  params?: { entityType?: string; entityId?: string; actorUserId?: string; take?: number }
) {
  const qs = new URLSearchParams();
  if (params?.entityType) qs.set('entityType', params.entityType);
  if (params?.entityId) qs.set('entityId', params.entityId);
  if (params?.actorUserId) qs.set('actorUserId', params.actorUserId);
  if (params?.take) qs.set('take', String(params.take));
  const query = qs.toString() ? `?${qs}` : '';
  return apiRequest<AuditLogEntry[]>(`/audit${query}`, { token: authToken });
}

// Authenticated CSV download (the access token is in-memory, so we fetch with the Bearer header then save a blob).
export async function downloadComplianceCsv(authToken: string, params?: { asOf?: string; siteId?: string }) {
  const qs = new URLSearchParams();
  if (params?.asOf) qs.set('asOf', params.asOf);
  if (params?.siteId) qs.set('siteId', params.siteId);
  const query = qs.toString() ? `?${qs}` : '';
  const response = await fetch(`${BACKEND_URL}/audit/compliance-report.csv${query}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (!response.ok) throw new Error('Failed to download compliance report.');
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `compliance-report-${(params?.asOf ?? new Date().toISOString()).slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
