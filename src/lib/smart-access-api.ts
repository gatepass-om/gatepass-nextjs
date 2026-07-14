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
  baseUrl?: string | null;
  supportsOnlineProvisioning: boolean;
  supportsRemoteCommands: boolean;
  supportsEventIngestion: boolean;
  supportsStatusPolling: boolean;
  supportsOfflineMobileSync: boolean;
};

export type DiscoveredSmartAccessDoor = {
  externalId: string;
  name: string;
  model?: string | null;
  rawType?: string | null;
};

export type TestSmartAccessProviderResult = {
  canConnect: boolean;
  credentialsAccepted: boolean;
  minimalFunctionalityReady: boolean;
  status: string;
  message: string;
  checks: string[];
  doors: DiscoveredSmartAccessDoor[];
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
  sentAtUtc?: string | null;
  completedAtUtc?: string | null;
  externalCommandId?: string | null;
  resultPayloadJson?: string | null;
  failureReason?: string | null;
};

export function listSmartAccessProviders(token: string) {
  return apiRequest<SmartAccessProvider[]>('/smart-access/providers', { token });
}

export function createSmartAccessProvider(token: string, input: {
  tenantId?: string | null;
  name: string;
  integrationKey: string;
  providerKind: number | string;
  supportsOnlineProvisioning: boolean;
  supportsRemoteCommands: boolean;
  supportsEventIngestion: boolean;
  supportsStatusPolling: boolean;
  supportsOfflineMobileSync: boolean;
  baseUrl?: string | null;
  configurationJson?: string | null;
}) {
  return apiRequest<SmartAccessProvider>('/smart-access/providers', {
    method: 'POST',
    token,
    body: { ...input },
  });
}

export function testSmartAccessProvider(token: string, input: {
  integrationKey: string;
  providerKind: number | string;
  baseUrl?: string | null;
  configurationJson?: string | null;
}) {
  return apiRequest<TestSmartAccessProviderResult>('/smart-access/providers/test', {
    method: 'POST',
    token,
    body: { ...input },
  });
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

export function createSmartAccessPoint(token: string, input: {
  siteId: string;
  accessZoneId?: string | null;
  physicalAssetId?: string | null;
  name: string;
  accessPointType: number | string;
  externalReference?: string | null;
  supportsEntry: boolean;
  supportsExit: boolean;
}) {
  return apiRequest<PhysicalAccessPoint>('/smart-access/access-points', {
    method: 'POST',
    token,
    body: { ...input },
  });
}

export function listSmartAccessDevices(token: string, input?: ListParams) {
  return apiRequest<AccessControlDevice[]>(`/smart-access/devices${buildQuery(input)}`, { token });
}

export function createSmartAccessDevice(token: string, input: {
  smartAccessProviderId: string;
  siteId: string;
  physicalAssetId?: string | null;
  physicalAccessPointId?: string | null;
  name: string;
  deviceKind: number | string;
  model: string;
  serialNumber: string;
  controllerIdentifier?: string | null;
  externalDeviceId?: string | null;
  firmwareVersion?: string | null;
  isBatteryFree: boolean;
  supportsRemoteCommands: boolean;
  supportsStatusPolling: boolean;
  supportsOfflineSync: boolean;
}) {
  return apiRequest<AccessControlDevice>('/smart-access/devices', {
    method: 'POST',
    token,
    body: { ...input },
  });
}

export function listSmartAccessPolicyMappings(token: string, input?: ListParams) {
  return apiRequest<AccessPolicyMapping[]>(`/smart-access/policy-mappings${buildQuery(input)}`, { token });
}

export function createSmartAccessPolicyMapping(token: string, input: {
  siteId: string;
  name: string;
  description?: string | null;
  smartAccessProviderId?: string | null;
  accessZoneId?: string | null;
  physicalAccessPointId?: string | null;
  physicalAssetId?: string | null;
  appliesToWorkers: boolean;
  appliesToVisitors: boolean;
  isDefaultForApprovedRequests: boolean;
  requiresManualProvisioning: boolean;
  priority: number;
  isExclusive: boolean;
}) {
  return apiRequest<AccessPolicyMapping>('/smart-access/policy-mappings', {
    method: 'POST',
    token,
    body: { ...input },
  });
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

export function createSmartAccessCommand(token: string, input: {
  smartAccessProviderId: string;
  siteId: string;
  physicalAccessPointId?: string | null;
  accessControlDeviceId?: string | null;
  commandType: 'Unlock' | 'Relock' | 'Sync' | 'RefreshStatus' | 'RevokeCredential' | string;
  payloadJson?: string;
}) {
  return apiRequest<DeviceCommand>('/smart-access/commands', {
    method: 'POST',
    token,
    body: input,
  });
}

export function importSmartAccessEvent(token: string, input: {
  smartAccessProviderId: string;
  siteId: string;
  userId?: string | null;
  accessRequestId?: string | null;
  physicalAssetId?: string | null;
  physicalAccessPointId?: string | null;
  accessControlDeviceId?: string | null;
  eventType: 'AccessGranted' | 'AccessDenied' | 'UnlockSucceeded' | 'UnlockFailed' | 'ForcedOpen' | 'TamperAlarm' | 'DeviceOffline' | 'DeviceOnline' | 'SyncCompleted' | 'SyncFailed' | 'CredentialUpdated' | 'HealthAlert' | string;
  severity?: 'Info' | 'Warning' | 'Critical' | string;
  occurredAtUtc?: string;
  externalEventId?: string;
  correlationKey?: string;
  message?: string;
  rawPayloadJson?: string;
}) {
  return apiRequest<DeviceEvent>('/smart-access/events/import', {
    method: 'POST',
    token,
    body: input,
  });
}
