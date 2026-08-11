import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's built-in TypeScript runner requires the source extension.
import { buildWorkerCardBatchPrintHtml, buildWorkerCardPrintHtml } from './worker-card-print.ts';

const branding = {
  companyName: 'GatePass Energy',
  cardLabel: 'PHOTO ID · QR VERIFIED',
  primaryColor: '#075985',
  secondaryColor: '#edf6fb',
  footerText: 'Company property · report loss immediately',
  logoUrl: null,
};

const visitorCard = {
  id: 'card-1',
  cardNumber: 'VIS-2026-0042',
  workerId: 'user-1',
  workerCode: 'V-0042',
  workerName: 'Omar Ali',
  employerName: 'Acme Services',
  jobTitle: 'Site visitor',
  role: 'Visitor',
  status: 'Issued' as const,
  isValid: true,
  credential: 'credential-token',
  photoDocumentId: 'photo-1',
  photoCropX: 0.5,
  photoCropY: 0.5,
  photoZoom: 1,
  issuedAtUtc: '2026-08-03T08:00:00Z',
  expiresAtUtc: '2026-08-04T18:00:00Z',
};

test('printable credential uses a role-coloured identity layout with live QR authority', () => {
  const html = buildWorkerCardPrintHtml({
    card: visitorCard,
    branding,
    qrDataUrl: 'data:image/png;base64,qr',
    photoDataUrl: 'data:image/jpeg;base64,photo',
    autoPrint: false,
  });

  assert.match(html, /data-card-role="visitor"/);
  assert.match(html, /--role-color:#f05a23/);
  assert.match(html, />VISITOR</);
  assert.match(html, /FULL NAME/);
  assert.match(html, /COMPANY/);
  assert.match(html, /POSITION/);
  assert.match(html, /PERSONNEL ID/);
  assert.match(html, /ISSUE DATE/);
  assert.match(html, /EXPIRY DATE/);
  assert.match(html, /\.date-label,.date-value\{display:block/);
  assert.match(html, /SCAN FOR LIVE ACCESS/);
  assert.match(html, /COLOR IDENTIFIES ROLE/);
});

test('printable credential escapes worker-controlled text', () => {
  const html = buildWorkerCardPrintHtml({
    card: { ...visitorCard, workerName: '<script>alert("x")</script>' },
    branding,
    qrDataUrl: 'data:image/png;base64,qr',
    photoDataUrl: null,
    autoPrint: false,
  });

  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);
});

test('batch printing preserves each persons role colour', () => {
  const html = buildWorkerCardBatchPrintHtml({
    branding,
    cards: [
      { card: visitorCard, qrDataUrl: 'data:image/png;base64,one', photoDataUrl: null },
      {
        card: { ...visitorCard, id: 'card-2', cardNumber: 'W-0002', role: 'Worker' },
        qrDataUrl: 'data:image/png;base64,two',
        photoDataUrl: null,
      },
    ],
    autoPrint: false,
  });

  assert.match(html, /data-card-role="visitor"[^>]*--role-color:#f05a23/);
  assert.match(html, /data-card-role="worker"[^>]*--role-color:#123b6d/);
});
