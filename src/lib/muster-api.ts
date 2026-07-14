import { apiRequest } from './api';

function buildQuery(input?: Record<string, string | boolean | null | undefined>) {
  const params = new URLSearchParams();
  Object.entries(input ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `?${query}` : '';
}

export type MusterRecordState = 'Unaccounted' | 'Accounted' | 'Evacuated' | string;

export type MusterRecord = {
  id: string;
  userId: string;
  userName: string;
  workerCode?: string | null;
  companyName?: string | null;
  lastSiteId?: string | null;
  lastGateName?: string | null;
  lastSeenAtUtc?: string | null;
  lastKnownZoneId?: string | null;
  lastKnownZoneName?: string | null;
  state: MusterRecordState;
  accountedByUserName?: string | null;
  accountedAtUtc?: string | null;
  note?: string | null;
};

export type MusterEventSummary = {
  id: string;
  siteId: string;
  siteName: string;
  status: 'Active' | 'Closed' | string;
  reason?: string | null;
  initiatedByUserName?: string | null;
  initiatedAtUtc: string;
  closedByUserName?: string | null;
  closedAtUtc?: string | null;
  expectedHeadcount: number;
  totalCount: number;
  accountedCount: number;
  unaccountedCount: number;
  evacuatedCount: number;
};

export type MusterEventDetail = MusterEventSummary & {
  records: MusterRecord[];
};

export function listMusters(token: string, input?: { siteId?: string; activeOnly?: boolean }) {
  return apiRequest<MusterEventSummary[]>(`/muster${buildQuery(input)}`, { token });
}

export function getMuster(token: string, id: string) {
  return apiRequest<MusterEventDetail>(`/muster/${id}`, { token });
}

export function initiateMuster(token: string, input: { siteId: string; reason?: string }) {
  return apiRequest<MusterEventDetail>('/muster', { method: 'POST', token, body: input });
}

export function checkOffMusterRecord(
  token: string,
  musterId: string,
  recordId: string,
  input: { state: MusterRecordState; note?: string },
) {
  return apiRequest<MusterRecord>(`/muster/${musterId}/records/${recordId}/check-off`, {
    method: 'POST',
    token,
    body: input,
  });
}

export function closeMuster(token: string, id: string) {
  return apiRequest<MusterEventDetail>(`/muster/${id}/close`, { method: 'POST', token });
}
