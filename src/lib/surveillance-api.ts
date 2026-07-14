import { apiRequest } from './api';

function buildQuery(input?: Record<string, string | boolean | null | undefined>) {
  const params = new URLSearchParams();
  Object.entries(input ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `?${query}` : '';
}

export type SurveillanceProvider = {
  id: string;
  tenantId?: string | null;
  name: string;
  integrationKey: string;
  providerKind: string;
  isActive: boolean;
  supportsEventIngestion: boolean;
  supportsClipRequests: boolean;
  supportsLiveView: boolean;
  baseUrl?: string | null;
  lastHealthCheckAtUtc?: string | null;
};

export type SurveillanceCamera = {
  id: string;
  surveillanceProviderId: string;
  siteId: string;
  physicalAssetId?: string | null;
  physicalAccessPointId?: string | null;
  geoRegionId?: string | null;
  name: string;
  cameraKind: string;
  model: string;
  serialNumber: string;
  externalCameraId?: string | null;
  status: string;
  supportsMotionDetection: boolean;
  supportsIntrusionDetection: boolean;
  supportsThermalMonitoring: boolean;
  isActive: boolean;
  lastSeenAtUtc?: string | null;
  lastHealthMessage?: string | null;
};

export type SurveillanceEvent = {
  id: string;
  surveillanceProviderId: string;
  siteId: string;
  surveillanceCameraId?: string | null;
  userId?: string | null;
  accessRequestId?: string | null;
  gateActivityId?: string | null;
  deviceEventId?: string | null;
  geofenceViolationId?: string | null;
  eventType: string;
  severity: string;
  occurredAtUtc: string;
  externalEventId?: string | null;
  correlationKey?: string | null;
  message?: string | null;
};

export type EvidenceClipRequest = {
  id: string;
  surveillanceProviderId: string;
  siteId: string;
  surveillanceCameraId: string;
  surveillanceEventId?: string | null;
  gateActivityId?: string | null;
  deviceEventId?: string | null;
  geofenceViolationId?: string | null;
  requestedFromUtc: string;
  requestedToUtc: string;
  status: string;
  requestedAtUtc: string;
  attemptCount: number;
  externalClipReference?: string | null;
  failureReason?: string | null;
};

export function listSurveillanceProviders(token: string) {
  return apiRequest<SurveillanceProvider[]>('/surveillance/providers', { token });
}

export function listSurveillanceCameras(token: string, input?: { siteId?: string; includeInactive?: boolean }) {
  return apiRequest<SurveillanceCamera[]>(`/surveillance/cameras${buildQuery(input)}`, { token });
}

export function createSurveillanceCamera(token: string, body: {
  surveillanceProviderId: string;
  siteId: string;
  name: string;
  cameraKind: string;
  model: string;
  serialNumber: string;
  externalCameraId?: string;
  supportsMotionDetection?: boolean;
  supportsIntrusionDetection?: boolean;
  supportsThermalMonitoring?: boolean;
}) {
  return apiRequest<SurveillanceCamera>('/surveillance/cameras', { method: 'POST', token, body });
}

export function updateSurveillanceCamera(token: string, id: string, body: Partial<SurveillanceCamera>) {
  return apiRequest<SurveillanceCamera>(`/surveillance/cameras/${id}`, { method: 'PUT', token, body });
}

export function deactivateSurveillanceCamera(token: string, id: string) {
  return apiRequest<void>(`/surveillance/cameras/${id}`, { method: 'DELETE', token });
}

export function listSurveillanceEvents(token: string, input?: { siteId?: string }) {
  return apiRequest<SurveillanceEvent[]>(`/surveillance/events${buildQuery(input)}`, { token });
}

export function listEvidenceClips(token: string, input?: { siteId?: string }) {
  return apiRequest<EvidenceClipRequest[]>(`/surveillance/evidence-clips${buildQuery(input)}`, { token });
}

export function requestEvidenceClip(token: string, body: {
  surveillanceCameraId: string;
  surveillanceEventId?: string;
  gateActivityId?: string;
  deviceEventId?: string;
  geofenceViolationId?: string;
  requestedFromUtc: string;
  requestedToUtc: string;
}) {
  return apiRequest<EvidenceClipRequest>('/surveillance/evidence-clips', { method: 'POST', token, body });
}
