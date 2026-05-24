import { apiRequest } from './api';

type ListParams = {
  siteId?: string;
  includeInactive?: boolean;
};

function buildQuery(input?: Record<string, string | number | boolean | null | undefined>) {
  const params = new URLSearchParams();
  Object.entries(input ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  });
  const query = params.toString();
  return query ? `?${query}` : '';
}

export type SmartAccessProvider = {
  id: string;
  tenantId?: string | null;
  name: string;
  integrationKey: string;
  providerKind: string;
  supportsOnlineProvisioning: boolean;
  supportsRemoteCommands: boolean;
  supportsEventIngestion: boolean;
  supportsStatusPolling: boolean;
  supportsOfflineMobileSync: boolean;
};

export type PhysicalAsset = {
  id: string;
  siteId: string;
  parentAssetId?: string | null;
  name: string;
  assetType: string;
  externalReference?: string | null;
  description?: string | null;
  isActive?: boolean;
};

export type AccessZone = {
  id: string;
  siteId: string;
  parentZoneId?: string | null;
  name: string;
  zoneType: string;
  description?: string | null;
  isActive?: boolean;
};

export type PhysicalAccessPoint = {
  id: string;
  siteId: string;
  accessZoneId?: string | null;
  physicalAssetId?: string | null;
  name: string;
  accessPointType: string;
  externalReference?: string | null;
  supportsEntry: boolean;
  supportsExit: boolean;
  isActive?: boolean;
};

export type AccessControlDevice = {
  id: string;
  smartAccessProviderId: string;
  siteId: string;
  physicalAssetId?: string | null;
  physicalAccessPointId?: string | null;
  name: string;
  deviceKind: string;
  model?: string | null;
  serialNumber: string;
  externalDeviceId?: string | null;
  connectivityStatus?: string;
  supportsRemoteCommands: boolean;
  supportsStatusPolling: boolean;
  supportsOfflineSync: boolean;
  isBatteryFree: boolean;
  isActive?: boolean;
};

export type AccessPolicyMapping = {
  id: string;
  siteId: string;
  name: string;
  smartAccessProviderId: string;
  accessZoneId?: string | null;
  physicalAccessPointId?: string | null;
  physicalAssetId?: string | null;
  appliesToWorkers: boolean;
  appliesToVisitors: boolean;
  isDefaultForApprovedRequests: boolean;
  requiresManualProvisioning: boolean;
  priority: number;
  isExclusive: boolean;
  isActive?: boolean;
};

export type DeviceAccessAssignment = {
  id: string;
  userId: string;
  siteId: string;
  smartAccessProviderId: string;
  accessRequestId?: string | null;
  accessPolicyMappingId?: string | null;
  accessZoneId?: string | null;
  physicalAccessPointId?: string | null;
  accessControlDeviceId?: string | null;
  status: string;
  validFromUtc?: string | null;
  validToUtc?: string | null;
  requiresSync: boolean;
  externalAssignmentId?: string | null;
  failureReason?: string | null;
};

export type DeviceSyncJob = {
  id: string;
  smartAccessProviderId: string;
  siteId: string;
  accessControlDeviceId?: string | null;
  deviceAccessAssignmentId?: string | null;
  requestedByUserId?: string | null;
  jobType: string;
  status: string;
  requestedAtUtc: string;
  attemptCount: number;
  resultSummary?: string | null;
  errorMessage?: string | null;
};

export type DeviceEvent = {
  id: string;
  smartAccessProviderId: string;
  siteId: string;
  userId?: string | null;
  accessRequestId?: string | null;
  physicalAccessPointId?: string | null;
  accessControlDeviceId?: string | null;
  eventType: string;
  severity: string;
  occurredAtUtc: string;
  externalEventId?: string | null;
  message?: string | null;
};

export type DeviceCommand = {
  id: string;
  smartAccessProviderId: string;
  siteId: string;
  physicalAccessPointId?: string | null;
  accessControlDeviceId?: string | null;
  requestedByUserId?: string | null;
  commandType: string;
  status: string;
  requestedAtUtc: string;
  completedAtUtc?: string | null;
  failureReason?: string | null;
};

export function listSmartAccessProviders(token: string) {
  return apiRequest<SmartAccessProvider[]>('/smart-access/providers', { token });
}

export function listSmartAccessAssets(token: string, input?: ListParams) {
  return apiRequest<PhysicalAsset[]>(`/smart-access/assets${buildQuery(input)}`, { token });
}

export function listSmartAccessZones(token: string, input?: ListParams) {
  return apiRequest<AccessZone[]>(`/smart-access/zones${buildQuery(input)}`, { token });
}

export function listSmartAccessPoints(token: string, input?: ListParams) {
  return apiRequest<PhysicalAccessPoint[]>(`/smart-access/access-points${buildQuery(input)}`, { token });
}

export function listSmartAccessDevices(token: string, input?: ListParams) {
  return apiRequest<AccessControlDevice[]>(`/smart-access/devices${buildQuery(input)}`, { token });
}

export function listSmartAccessPolicyMappings(token: string, input?: ListParams) {
  return apiRequest<AccessPolicyMapping[]>(`/smart-access/policy-mappings${buildQuery(input)}`, { token });
}

export function listSmartAccessAssignments(token: string, input?: { siteId?: string }) {
  return apiRequest<DeviceAccessAssignment[]>(`/smart-access/assignments${buildQuery(input)}`, { token });
}

export function listSmartAccessSyncJobs(token: string, input?: { siteId?: string }) {
  return apiRequest<DeviceSyncJob[]>(`/smart-access/sync-jobs${buildQuery(input)}`, { token });
}

export function retrySmartAccessSyncJob(token: string, jobId: string) {
  return apiRequest<DeviceSyncJob>(`/smart-access/sync-jobs/${jobId}/retry`, {
    method: 'POST',
    token,
  });
}

export function listSmartAccessEvents(token: string, input?: { siteId?: string }) {
  return apiRequest<DeviceEvent[]>(`/smart-access/events${buildQuery(input)}`, { token });
}

export function listSmartAccessCommands(token: string, input?: { siteId?: string }) {
  return apiRequest<DeviceCommand[]>(`/smart-access/commands${buildQuery(input)}`, { token });
}
