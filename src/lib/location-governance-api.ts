import { apiRequest } from './api';

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

export type GeoPoint = {
  latitude: number;
  longitude: number;
};

export type GeoRegion = {
  id: string;
  name: string;
  description?: string | null;
  operatorId?: string | null;
  operatorName?: string | null;
  siteId?: string | null;
  siteName?: string | null;
  contractorId?: string | null;
  contractorName?: string | null;
  shape: 'Circle' | 'Polygon' | string;
  centerLatitude?: number | null;
  centerLongitude?: number | null;
  radiusMeters?: number | null;
  polygon: GeoPoint[];
  governanceMode: string;
  isActive: boolean;
  gracePeriodSeconds: number;
};

export type WorkZoneAssignment = {
  id: string;
  geoRegionId: string;
  geoRegionName: string;
  userId?: string | null;
  userName?: string | null;
  contractorId?: string | null;
  contractorName?: string | null;
  accessRequestId?: string | null;
  permitToWorkId?: string | null;
  validFromUtc: string;
  validToUtc?: string | null;
  governanceMode: string;
  isActive: boolean;
  notes?: string | null;
};

export type GeofenceViolation = {
  id: string;
  userId: string;
  userName: string;
  workSessionId?: string | null;
  geoRegionId?: string | null;
  geoRegionName?: string | null;
  severity: string;
  status: string;
  firstDetectedAtUtc: string;
  lastDetectedAtUtc: string;
  description: string;
};

export type LocationValidationResult = {
  id: string;
  userId: string;
  userName: string;
  geoRegionId?: string | null;
  geoRegionName?: string | null;
  siteId?: string | null;
  accessRequestId?: string | null;
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
  distanceFromBoundaryMeters?: number | null;
  result: 'Inside' | 'Outside' | 'Unknown' | string;
  source: string;
  observedAtUtc: string;
  reason?: string | null;
};

export type WorkSession = {
  id: string;
  userId: string;
  userName: string;
  siteId?: string | null;
  siteName?: string | null;
  accessRequestId?: string | null;
  permitToWorkId?: string | null;
  status: string;
  startedAtUtc: string;
  endedAtUtc?: string | null;
  notes?: string | null;
};

export type WorkSessionPing = {
  id: string;
  workSessionId: string;
  userId: string;
  geoRegionId?: string | null;
  geoRegionName?: string | null;
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
  result: 'Inside' | 'Outside' | 'Unknown' | string;
  source: string;
  observedAtUtc: string;
  reason?: string | null;
};

export function listGeoRegions(
  token: string,
  input?: { siteId?: string; includeInactive?: boolean }
) {
  return apiRequest<GeoRegion[]>(`/location/geofences${buildQuery(input)}`, { token });
}

export function createGeoRegion(
  token: string,
  body: {
    name: string;
    description?: string | null;
    operatorId?: string | null;
    siteId?: string | null;
    contractorId?: string | null;
    shape: 'Circle' | 'Polygon' | string;
    centerLatitude?: number | null;
    centerLongitude?: number | null;
    radiusMeters?: number | null;
    polygon?: GeoPoint[];
    governanceMode?: string;
    gracePeriodSeconds?: number;
  }
) {
  return apiRequest<GeoRegion>('/location/geofences', { method: 'POST', token, body });
}

export function updateGeoRegion(token: string, id: string, body: Partial<GeoRegion>) {
  return apiRequest<GeoRegion>(`/location/geofences/${id}`, { method: 'PUT', token, body });
}

export function deleteGeoRegion(token: string, id: string) {
  return apiRequest<void>(`/location/geofences/${id}`, { method: 'DELETE', token });
}

export function listWorkZoneAssignments(
  token: string,
  input?: { userId?: string; contractorId?: string; geoRegionId?: string }
) {
  return apiRequest<WorkZoneAssignment[]>(`/location/work-zone-assignments${buildQuery(input)}`, { token });
}

export function createWorkZoneAssignment(
  token: string,
  body: {
    geoRegionId: string;
    userId?: string | null;
    contractorId?: string | null;
    accessRequestId?: string | null;
    permitToWorkId?: string | null;
    validFromUtc?: string | null;
    validToUtc?: string | null;
    governanceMode?: string;
    notes?: string | null;
  }
) {
  return apiRequest<WorkZoneAssignment>('/location/work-zone-assignments', { method: 'POST', token, body });
}

export function validateLocation(
  token: string,
  body: {
    userId?: string | null;
    geoRegionId?: string | null;
    siteId?: string | null;
    accessRequestId?: string | null;
    latitude: number;
    longitude: number;
    accuracyMeters?: number | null;
    source?: string;
    observedAtUtc?: string | null;
  }
) {
  return apiRequest<LocationValidationResult>('/location/validate', { method: 'POST', token, body });
}

export function startWorkSession(
  token: string,
  body: {
    userId: string;
    siteId?: string | null;
    accessRequestId?: string | null;
    permitToWorkId?: string | null;
    notes?: string | null;
  }
) {
  return apiRequest<WorkSession>('/location/work-sessions', { method: 'POST', token, body });
}

export function recordWorkSessionPing(
  token: string,
  workSessionId: string,
  body: {
    latitude: number;
    longitude: number;
    accuracyMeters?: number | null;
    source?: string;
    observedAtUtc?: string | null;
  }
) {
  return apiRequest<WorkSessionPing>(`/location/work-sessions/${workSessionId}/pings`, {
    method: 'POST',
    token,
    body,
  });
}

export function endWorkSession(token: string, workSessionId: string) {
  return apiRequest<WorkSession>(`/location/work-sessions/${workSessionId}/end`, {
    method: 'POST',
    token,
  });
}

export function listGeofenceViolations(
  token: string,
  input?: { userId?: string; geoRegionId?: string; openOnly?: boolean }
) {
  return apiRequest<GeofenceViolation[]>(`/location/violations${buildQuery(input)}`, { token });
}
