import { expect, test } from '@playwright/test';

import {
  bulkRegisterUsersRequest,
  createAccessRequest,
  updateAccessRequest,
  createUserRequest,
  transitionWorkerClearance,
  updateUserRequest,
  listRegistrationProfilesRequest,
  saveRegistrationValuesRequest,
  createReportScheduleRequest,
  listReportSchedulesRequest,
  updateReportScheduleRequest,
  createShiftRosterRequest,
  listShiftRostersRequest,
  updateShiftRosterRequest,
  listEligibleShiftRosterWorkersRequest,
} from '../src/lib/api';
import {
  canEditUserRecord,
  canImpersonateUser,
  canLoadPersonnelData,
  shouldShowWorkerDocuments,
} from '../src/components/users/user-actions';
import { getWorkerClearanceActions } from '../src/components/workers/worker-clearance-actions';
import {
  buildWorkerCardBatchPrintHtml,
  buildWorkerCardPrintHtml,
} from '../src/components/workers/worker-card-print';
import { hashWorkerCardCredential, verifyWorkerCardOffline } from '../src/lib/worker-card-offline';
import { parseBulkRosterCsv } from '../src/components/users/bulk-registration-parser';
import { getNavigationForRole } from '../src/components/layout/sidebar-navigation';
import { buildAccessApprovalUpdate } from '../src/lib/access-request-contract';

test('createAccessRequest sends the current ASP.NET request contract', async () => {
  const originalFetch = globalThis.fetch;
  let requestBody: unknown;

  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ id: 'request-1' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    await createAccessRequest('test-token', {
      supervisorId: 'supervisor-1',
      contractorId: 'contractor-1',
      siteId: 'site-1',
      contractNumber: 'CONTRACT-1',
      focalPoint: 'Site Manager',
      notes: 'Night shift',
      workerIds: ['worker-1', 'worker-2'],
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  expect(requestBody).toEqual({
    supervisorId: 'supervisor-1',
    contractorId: 'contractor-1',
    siteId: 'site-1',
    contractNumber: 'CONTRACT-1',
    focalPoint: 'Site Manager',
    notes: 'Night shift',
    workerIds: ['worker-1', 'worker-2'],
  });
});

test('access approval sends UTC validity fields and permanent state', async () => {
  const originalFetch = globalThis.fetch;
  let requestBody: unknown;

  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ id: 'request-1' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    await updateAccessRequest(
      'test-token',
      'request-1',
      buildAccessApprovalUpdate(
        new Date('2026-08-10T00:00:00.000Z'),
        new Date('2026-08-11T00:00:00.000Z'),
      ),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  expect(requestBody).toEqual({
    status: 'Approved',
    validFromUtc: '2026-08-10T00:00:00.000Z',
    expiresAtUtc: '2026-08-11T00:00:00.000Z',
    isPermanent: false,
  });
});

test('updateUserRequest sends certificate IDs and UTC expiry fields', async () => {
  const originalFetch = globalThis.fetch;
  let requestBody: unknown;

  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ id: 'worker-1' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    await updateUserRequest('test-token', 'worker-1', {
      certificates: [
        {
          certificateTypeId: 'certificate-type-1',
          expiresAtUtc: '2027-07-23T00:00:00.000Z',
        },
      ],
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  expect(requestBody).toEqual({
    certificates: [
      {
        certificateTypeId: 'certificate-type-1',
        expiresAtUtc: '2027-07-23T00:00:00.000Z',
      },
    ],
  });
});

test('createUserRequest supports device-less assisted personnel records', async () => {
  const originalFetch = globalThis.fetch;
  let requestBody: unknown;

  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ id: 'worker-1', name: 'Ravi' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    await createUserRequest('test-token', {
      name: 'Ravi Kumar',
      role: 'Worker',
      interactiveAccountEnabled: false,
      preferredName: 'Ravi',
      preferredLanguage: 'hi',
      preferredInteractionMode: 'PrintedCard',
      needsAssistedWorkflow: true,
      personalDeviceAvailable: false,
      canReceiveSms: false,
      offlineCardRequired: true,
      audioInstructionsPreferred: true,
      largeTextPreferred: false,
      interpreterRequired: true,
      registrationChannel: 'Assisted',
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  expect(requestBody).toMatchObject({
    interactiveAccountEnabled: false,
    preferredName: 'Ravi',
    preferredLanguage: 'hi',
    preferredInteractionMode: 'PrintedCard',
    needsAssistedWorkflow: true,
    personalDeviceAvailable: false,
    canReceiveSms: false,
    offlineCardRequired: true,
    audioInstructionsPreferred: true,
    interpreterRequired: true,
    registrationChannel: 'Assisted',
  });
});

test('bulk roster API supports preview without creating records', async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl = '';
  let requestBody: unknown;

  globalThis.fetch = async (input, init) => {
    requestUrl = String(input);
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ total: 1, valid: 1, invalid: 0, created: 0, dryRun: true, results: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    await bulkRegisterUsersRequest('test-token', {
      idempotencyKey: 'preview-1',
      dryRun: true,
      users: [{ name: 'Worker One', role: 'Worker', interactiveAccountEnabled: false }],
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  expect(requestUrl).toContain('/users/bulk');
  expect(requestBody).toMatchObject({ idempotencyKey: 'preview-1', dryRun: true });
});

test('bulk roster parser accepts simple low-tech spreadsheet exports', () => {
  const rows = parseBulkRosterCsv([
    'name,workerCode,preferredLanguage,interactionMode,phoneAvailable',
    'Asha Devi,W-101,hi,PrintedCard,no',
    'Salim Ali,W-102,ar,SupervisorAssisted,yes',
  ].join('\n'));

  expect(rows).toHaveLength(2);
  expect(rows[0]).toMatchObject({
    name: 'Asha Devi',
    workerCode: 'W-101',
    preferredLanguage: 'hi',
    preferredInteractionMode: 'PrintedCard',
    interactiveAccountEnabled: false,
    personalDeviceAvailable: false,
  });
  expect(rows[1].personalDeviceAvailable).toBe(true);
});

test('registration profile API lists definitions and saves entity values', async () => {
  const originalFetch = globalThis.fetch;
  const requests: { url: string; body?: unknown }[] = [];

  globalThis.fetch = async (input, init) => {
    requests.push({
      url: String(input),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    await listRegistrationProfilesRequest('test-token', 'Worker');
    await saveRegistrationValuesRequest('test-token', 'Worker', 'worker-1', 'profile-1', {
      transport_route: 'Route 7',
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  expect(requests[0].url).toContain('/registration/profiles?entityType=Worker');
  expect(requests[1].url).toContain('/registration/values/Worker/worker-1');
  expect(requests[1].body).toEqual({
    registrationProfileId: 'profile-1',
    values: { transport_route: 'Route 7' },
  });
});

test('report schedule API supports listing, creation, and pausing', async () => {
  const originalFetch = globalThis.fetch;
  const requests: { url: string; method?: string; body?: unknown }[] = [];

  globalThis.fetch = async (input, init) => {
    requests.push({
      url: String(input),
      method: init?.method,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const schedule = {
    name: 'Daily compliance pack',
    frequency: 'Daily' as const,
    timeZoneId: 'Asia/Muscat',
    localHour: 6,
    localMinute: 30,
    isActive: true,
  };

  try {
    await listReportSchedulesRequest('test-token');
    await createReportScheduleRequest('test-token', schedule);
    await updateReportScheduleRequest('test-token', 'schedule-1', { ...schedule, isActive: false });
  } finally {
    globalThis.fetch = originalFetch;
  }

  expect(requests.map((request) => [request.method, request.url])).toEqual([
    ['GET', expect.stringContaining('/audit/compliance-report/schedules')],
    ['POST', expect.stringContaining('/audit/compliance-report/schedules')],
    ['PUT', expect.stringContaining('/audit/compliance-report/schedules/schedule-1')],
  ]);
  expect(requests[2].body).toMatchObject({ isActive: false });
});

test('shift roster API preserves plain local times, work days, and worker IDs', async () => {
  const originalFetch = globalThis.fetch;
  const requests: { url: string; method?: string; body?: unknown }[] = [];
  globalThis.fetch = async (input, init) => {
    requests.push({
      url: String(input),
      method: init?.method,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  const roster = {
    name: 'Day crew',
    siteId: 'site-1',
    timeZoneId: 'Asia/Muscat',
    startLocalTime: '07:00',
    endLocalTime: '19:00',
    daysOfWeek: [0, 1, 2, 3, 4],
    workerIds: ['worker-1', 'worker-2'],
    isActive: true,
  };

  try {
    await listShiftRostersRequest('test-token');
    await listEligibleShiftRosterWorkersRequest('test-token', 'site-1', 'worker');
    await createShiftRosterRequest('test-token', roster);
    await updateShiftRosterRequest('test-token', 'roster-1', { ...roster, isActive: false });
  } finally {
    globalThis.fetch = originalFetch;
  }

  expect(requests.map((request) => [request.method, request.url])).toEqual([
    ['GET', expect.stringContaining('/shift-rosters')],
    ['GET', expect.stringContaining('/shift-rosters/eligible-workers?siteId=site-1&search=worker')],
    ['POST', expect.stringContaining('/shift-rosters')],
    ['PUT', expect.stringContaining('/shift-rosters/roster-1')],
  ]);
  expect(requests[2].body).toMatchObject({
    startLocalTime: '07:00',
    daysOfWeek: [0, 1, 2, 3, 4],
    workerIds: ['worker-1', 'worker-2'],
  });
});

test('authorized user managers can edit worker and supervisor records', () => {
  expect(canEditUserRecord(true, 'Worker')).toBe(true);
  expect(canEditUserRecord(true, 'Supervisor')).toBe(true);
  expect(canEditUserRecord(false, 'Worker')).toBe(false);
});

test('impersonation is available only to admins and never for their own row', () => {
  expect(canImpersonateUser('Admin', 'admin-1', 'worker-1')).toBe(true);
  expect(canImpersonateUser('Operator Admin', 'operator-admin-1', 'security-1')).toBe(true);
  expect(canImpersonateUser('Contractor Admin', 'contractor-admin-1', 'worker-1')).toBe(true);
  expect(canImpersonateUser('Manager', 'manager-1', 'worker-1')).toBe(false);
  expect(canImpersonateUser('Security', 'security-1', 'worker-1')).toBe(false);
  expect(canImpersonateUser('Admin', 'admin-1', 'admin-1')).toBe(false);
});

test('personnel data is not loaded after impersonating a role without personnel access', () => {
  expect(canLoadPersonnelData('Admin')).toBe(true);
  expect(canLoadPersonnelData('Manager')).toBe(true);
  expect(canLoadPersonnelData('Supervisor')).toBe(true);
  expect(canLoadPersonnelData('Worker')).toBe(false);
});

test('supervisor navigation exposes the complete read-only contractor workspace', () => {
  const links = getNavigationForRole('Supervisor').map((item) => item.href);

  expect(links).toEqual(expect.arrayContaining([
    '/dashboard',
    '/access-requests',
    '/projects',
    '/location-governance',
    '/permits',
    '/companies',
    '/users',
    '/profile',
  ]));
});

test('worker document management is shown only for worker records', () => {
  expect(shouldShowWorkerDocuments('Worker')).toBe(true);
  expect(shouldShowWorkerDocuments('Supervisor')).toBe(false);
  expect(shouldShowWorkerDocuments('Admin')).toBe(false);
});

test('worker clearance transition uses the worker-scoped endpoint and note body', async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl = '';
  let requestBody: unknown;

  globalThis.fetch = async (input, init) => {
    requestUrl = String(input);
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ workerId: 'worker-1', status: 'Cleared' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    await transitionWorkerClearance('test-token', 'worker-1', 'clear', 'Documents verified');
  } finally {
    globalThis.fetch = originalFetch;
  }

  expect(requestUrl).toContain('/workers/worker-1/clearance/clear');
  expect(requestBody).toEqual({ note: 'Documents verified' });
});

test('worker clearance actions follow submitter and reviewer responsibilities', () => {
  expect(getWorkerClearanceActions('Supervisor', 'Pending')).toEqual(['submit']);
  expect(getWorkerClearanceActions('Supervisor', 'Returned')).toEqual(['submit']);
  expect(getWorkerClearanceActions('Manager', 'Submitted')).toEqual(['start-review', 'return']);
  expect(getWorkerClearanceActions('Consultant', 'UnderReview')).toEqual(['clear', 'return']);
  expect(getWorkerClearanceActions('Worker', 'Submitted')).toEqual([]);
});

test('worker card print HTML applies branding and persisted photo crop safely', () => {
  const html = buildWorkerCardPrintHtml({
    card: {
      id: 'card-1',
      cardNumber: 'GP-26-1234',
      workerId: 'worker-1',
      workerCode: 'W-1',
      workerName: '<script>alert(1)</script>',
      employerName: 'Example Contractor',
      jobTitle: 'Technician',
      role: 'Worker',
      status: 'Issued',
      isValid: true,
      credential: 'gpc_credential',
      photoDocumentId: 'photo-1',
      photoCropX: 0.25,
      photoCropY: 0.75,
      photoZoom: 1.5,
      issuedAtUtc: '2026-07-23T00:00:00Z',
    },
    branding: {
      companyName: 'Client & Co',
      cardLabel: 'AUTHORIZED WORKER',
      primaryColor: '#123456',
      secondaryColor: '#ABCDEF',
      footerText: 'Scan for live status',
    },
    qrDataUrl: 'data:image/png;base64,qr',
    photoDataUrl: 'data:image/jpeg;base64,photo',
    autoPrint: false,
  });

  expect(html).toContain('@page{size:85.6mm 53.98mm');
  expect(html).toContain('Client &amp; Co');
  expect(html).toContain('data-card-role="worker"');
  expect(html).toContain('--role-color:#123b6d');
  expect(html).toContain('SCAN FOR LIVE ACCESS');
  expect(html).toContain('object-position:25% 75%');
  expect(html).toContain('transform:scale(1.5)');
  expect(html).not.toContain('<script>alert(1)</script>');
  expect(html).not.toContain('window.print()');
});

test('worker card batch print produces one CR80 sheet per selected card', () => {
  const card = {
    id: 'card-1',
    cardNumber: 'GP-26-0001',
    workerId: 'worker-1',
    workerCode: 'W-1',
    workerName: 'Worker One',
    employerName: 'Example Contractor',
    jobTitle: 'Technician',
    role: 'Worker',
    status: 'Issued' as const,
    isValid: true,
    credential: 'gpc_first',
    photoCropX: 0.5,
    photoCropY: 0.5,
    photoZoom: 1,
    issuedAtUtc: '2026-07-23T00:00:00Z',
  };
  const html = buildWorkerCardBatchPrintHtml({
    branding: {
      companyName: 'Client',
      cardLabel: 'WORKER ID',
      primaryColor: '#123456',
      secondaryColor: '#ABCDEF',
      footerText: 'Identity verification only',
    },
    cards: [
      { card, qrDataUrl: 'data:image/png;base64,one', photoDataUrl: null },
      {
        card: { ...card, id: 'card-2', cardNumber: 'GP-26-0002', workerName: 'Worker Two' },
        qrDataUrl: 'data:image/png;base64,two',
        photoDataUrl: null,
      },
    ],
    autoPrint: false,
  });

  expect(html).toContain('GP-26-0001');
  expect(html).toContain('GP-26-0002');
  expect(html.match(/class="card card-sheet"/g)).toHaveLength(2);
  expect(html).toContain('break-after:page');
  expect(html).not.toContain('window.print()');
});

test('offline worker-card verification expires safely and never grants authorization', async () => {
  const credential = 'gpc_offline-test';
  const credentialHash = await hashWorkerCardCredential(credential);
  const manifest = {
    schemaVersion: 1 as const,
    version: 'manifest-v1',
    purpose: 'IdentityOnly' as const,
    authorizationRequiresOnline: true as const,
    generatedAtUtc: '2026-07-23T10:00:00Z',
    expiresAtUtc: '2026-07-23T10:15:00Z',
    site: {
      id: 'site-1',
      name: 'Open Area',
      requiresAccessApproval: false,
      usesSecurityCheckpoints: false,
      usesSmartAccess: false,
    },
    entries: [{
      credentialHash,
      cardNumber: 'GP-26-0001',
      workerId: 'worker-1',
      workerCode: 'W-001',
      workerName: 'Worker One',
      employerName: 'Contractor',
      jobTitle: 'Technician',
      role: 'Worker',
      expiresAtUtc: '2027-07-23T00:00:00Z',
    }],
  };

  const match = await verifyWorkerCardOffline(
    credential,
    manifest,
    new Date('2026-07-23T10:05:00Z'),
  );
  expect(match.kind).toBe('identity-match');
  expect(match.authorizationGranted).toBe(false);

  const stale = await verifyWorkerCardOffline(
    credential,
    manifest,
    new Date('2026-07-23T10:16:00Z'),
  );
  expect(stale.kind).toBe('manifest-expired');
  expect(stale.authorizationGranted).toBe(false);
});
