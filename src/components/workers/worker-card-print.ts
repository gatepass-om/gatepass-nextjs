import type { WorkerCard, WorkerCardBranding } from '@/lib/api';

export interface WorkerCardPrintInput {
  card: WorkerCard;
  branding: WorkerCardBranding;
  qrDataUrl: string;
  photoDataUrl: string | null;
  autoPrint?: boolean;
}

export interface WorkerCardBatchPrintInput {
  branding: WorkerCardBranding;
  cards: Array<{
    card: WorkerCard;
    qrDataUrl: string;
    photoDataUrl: string | null;
  }>;
  autoPrint?: boolean;
}

export function escapeWorkerCardHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character);
}

type WorkerCardTheme = {
  slug: string;
  label: string;
  color: string;
  softColor: string;
};

const roleThemes: Record<string, Omit<WorkerCardTheme, 'slug'>> = {
  worker: { label: 'WORKER', color: '#123b6d', softColor: '#eaf1f8' },
  visitor: { label: 'VISITOR', color: '#f05a23', softColor: '#fff0e9' },
  security: { label: 'SECURITY', color: '#b42318', softColor: '#feebe9' },
  inspector: { label: 'INSPECTOR', color: '#0f766e', softColor: '#e6f5f3' },
  supervisor: { label: 'SUPERVISOR', color: '#6d28d9', softColor: '#f1eafe' },
  manager: { label: 'MANAGER', color: '#334155', softColor: '#edf1f5' },
  contractoradmin: { label: 'CONTRACTOR', color: '#167442', softColor: '#e9f6ef' },
  operatoradmin: { label: 'OPERATOR', color: '#075985', softColor: '#e6f3f8' },
  admin: { label: 'ADMINISTRATION', color: '#7c2d12', softColor: '#f8eee9' },
};

function resolveWorkerCardTheme(role: string | undefined, fallbackColor: string): WorkerCardTheme {
  const normalizedRole = role?.trim().toLowerCase().replace(/[^a-z0-9]/g, '') || 'personnel';
  const theme = roleThemes[normalizedRole];
  if (theme) return { slug: normalizedRole, ...theme };

  return {
    slug: 'personnel',
    label: role?.trim().toUpperCase() || 'PERSONNEL',
    color: /^#[0-9a-f]{3,8}$/i.test(fallbackColor) ? fallbackColor : '#123b6d',
    softColor: '#edf2f7',
  };
}

function formatCardDate(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value)).toUpperCase();
}

export function buildWorkerCardPrintHtml({
  card,
  branding,
  qrDataUrl,
  photoDataUrl,
  autoPrint = true,
}: WorkerCardPrintInput) {
  const initials = card.workerName
    .split(/\s+/)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const expires = card.expiresAtUtc
    ? formatCardDate(card.expiresAtUtc, 'NO EXPIRY')
    : 'NO EXPIRY';
  const issued = formatCardDate(card.issuedAtUtc, '—');
  const cropX = Math.round(Math.min(1, Math.max(0, card.photoCropX)) * 100);
  const cropY = Math.round(Math.min(1, Math.max(0, card.photoCropY)) * 100);
  const zoom = Math.min(3, Math.max(1, card.photoZoom));
  const brand = escapeWorkerCardHtml(branding.companyName);
  const theme = resolveWorkerCardTheme(card.role, branding.primaryColor);
  const roleSlug = escapeWorkerCardHtml(theme.slug);
  const roleLabel = escapeWorkerCardHtml(theme.label);
  const logo = branding.logoUrl
    ? `<img class="logo" src="${escapeWorkerCardHtml(branding.logoUrl)}" alt="">`
      : `<span class="logo-fallback">GP</span>`;

  return `<!doctype html><html><head>
    <meta charset="utf-8"><title>${escapeWorkerCardHtml(card.cardNumber)}</title>
    <style>
      @page{size:85.6mm 53.98mm;margin:0}
      *{box-sizing:border-box}
      html,body{width:85.6mm;height:53.98mm;margin:0}
      body{font-family:Arial,Helvetica,sans-serif;color:#172033;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .card{position:relative;width:85.6mm;height:53.98mm;overflow:hidden;border:.28mm solid #cbd3dd;border-radius:2.3mm;background:#fff}
      .card:after{content:"";position:absolute;right:-12mm;top:9mm;width:45mm;height:45mm;background:linear-gradient(135deg,transparent 35%,var(--role-soft) 35%,var(--role-soft) 36%,transparent 36%,transparent 52%,var(--role-soft) 52%,var(--role-soft) 53%,transparent 53%);opacity:.55;pointer-events:none}
      .head{position:relative;z-index:1;height:9.2mm;border-bottom:.25mm solid #d9e0e7;display:flex;align-items:center;justify-content:space-between;background:#fff}
      .role-banner{height:100%;min-width:31mm;padding:0 8mm 0 4mm;display:flex;align-items:center;background:var(--role-color);color:#fff;clip-path:polygon(0 0,88% 0,100% 100%,0 100%);font-size:3.6mm;font-weight:900;letter-spacing:.18mm}
      .slot{position:absolute;left:50%;top:2.6mm;transform:translateX(-50%);width:13mm;height:2.5mm;border:.35mm solid #c7cdd4;border-radius:3mm;background:#f7f8fa;box-shadow:inset 0 .25mm .4mm #dfe3e8}
      .brand-wrap{display:flex;align-items:center;justify-content:flex-end;gap:1.4mm;padding-right:3mm;max-width:31mm}.logo{max-width:9mm;max-height:6mm}.logo-fallback{display:grid;place-items:center;width:6mm;height:6mm;border-radius:50%;background:var(--role-color);color:#fff;font-size:2.4mm;font-weight:900}.brand{font-size:2.5mm;font-weight:900;line-height:1.05;text-align:right;letter-spacing:.08mm}
      .body{position:relative;z-index:1;display:grid;grid-template-columns:24mm minmax(0,1fr) 18mm;gap:2.4mm;height:37.6mm;padding:2.2mm 3mm 1.8mm}
      .photo-frame{width:24mm;height:31.2mm;overflow:hidden;border-radius:1.5mm;border:.45mm solid var(--role-color);background:var(--role-soft);box-shadow:0 .5mm 1.2mm rgba(15,23,42,.12)}
      .photo{width:100%;height:100%;object-fit:cover;object-position:${cropX}% ${cropY}%;transform:scale(${zoom})}
      .initials{display:flex;align-items:center;justify-content:center;font-size:8mm;font-weight:900;color:var(--role-color)}
      .details{min-width:0;padding-top:.2mm}.field{margin-bottom:1.1mm}.field-label{display:block;font-size:1.45mm;font-weight:800;line-height:1;color:#6b7280;letter-spacing:.18mm}.field-value{display:block;margin-top:.35mm;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:2.35mm;font-weight:750;line-height:1.05;color:#172033}.field.name .field-value{font-size:3.3mm;font-weight:900;letter-spacing:.05mm}.field.id .field-value{font-family:"Courier New",monospace;font-weight:900;letter-spacing:.1mm}
      .verify-panel{display:flex;flex-direction:column;align-items:center;padding-top:.4mm}.qr-frame{width:17.2mm;height:17.2mm;padding:.75mm;border:.45mm solid var(--role-color);border-radius:1.5mm;background:#fff}.qr{display:block;width:100%;height:100%}.verify{margin-top:1mm;text-align:center;font-size:1.7mm;font-weight:900;line-height:1.1;color:var(--role-color);letter-spacing:.05mm}.access-chip{margin-top:1.4mm;padding:1.1mm 1.6mm;border-radius:1mm;background:var(--role-color);color:#fff;font-size:1.7mm;font-weight:900;line-height:1;white-space:nowrap}.rule-note{margin-top:1.2mm;text-align:center;font-size:1.25mm;font-weight:700;line-height:1.15;color:#64748b}
      .foot{position:absolute;z-index:2;bottom:0;left:0;right:0;height:7.1mm;padding:.85mm 3.2mm;background:var(--role-color);color:#fff;display:grid;grid-template-columns:1fr 1fr 1.3fr;align-items:center;gap:2mm}.date-block{display:grid;grid-template-columns:3.6mm 1fr;align-items:center;gap:.9mm}.date-icon{display:grid;place-items:center;width:3.6mm;height:3.6mm;border:.3mm solid rgba(255,255,255,.75);border-radius:50%;font-size:1.8mm}.date-label,.date-value{display:block;line-height:1}.date-label{font-size:1.2mm;font-weight:700;opacity:.78;letter-spacing:.08mm}.date-value{margin-top:.45mm;font-size:1.85mm;font-weight:900;white-space:nowrap}.serial{text-align:right}.serial-label,.serial-value{display:block;line-height:1}.serial-label{font-size:1.2mm;font-weight:700;opacity:.78}.serial-value{margin-top:.45mm;font-family:"Courier New",monospace;font-size:2.2mm;font-weight:900;letter-spacing:.12mm;white-space:nowrap}
      @media print{.card{border:0}}
    </style></head><body><main class="card" data-card-role="${roleSlug}" style="--role-color:${theme.color};--role-soft:${theme.softColor}">
      <div class="head"><div class="role-banner">${roleLabel}</div><div class="slot" aria-hidden="true"></div><span class="brand-wrap">${logo}<span class="brand">${brand}</span></span></div>
      <div class="body">
        ${photoDataUrl
          ? `<div class="photo-frame"><img class="photo" src="${escapeWorkerCardHtml(photoDataUrl)}" alt=""></div>`
          : `<div class="photo-frame initials">${escapeWorkerCardHtml(initials)}</div>`}
        <section class="details">
          <div class="field name"><span class="field-label">FULL NAME</span><span class="field-value">${escapeWorkerCardHtml(card.workerName)}</span></div>
          <div class="field"><span class="field-label">COMPANY</span><span class="field-value">${escapeWorkerCardHtml(card.employerName || '—')}</span></div>
          <div class="field"><span class="field-label">POSITION</span><span class="field-value">${escapeWorkerCardHtml(card.jobTitle || roleLabel)}</span></div>
          <div class="field id"><span class="field-label">PERSONNEL ID</span><span class="field-value">${escapeWorkerCardHtml(card.workerCode)}</span></div>
          <div class="field id"><span class="field-label">CARD NUMBER</span><span class="field-value">${escapeWorkerCardHtml(card.cardNumber)}</span></div>
        </section>
        <section class="verify-panel"><div class="qr-frame"><img class="qr" src="${escapeWorkerCardHtml(qrDataUrl)}" alt="QR credential"></div><div class="verify">SCAN FOR LIVE ACCESS</div><div class="access-chip">QR VERIFIED</div><div class="rule-note">COLOR IDENTIFIES ROLE<br>QR CONFIRMS AUTHORITY</div></section>
      </div>
      <div class="foot"><div class="date-block"><span class="date-icon">◆</span><span><span class="date-label">ISSUE DATE</span><span class="date-value">${escapeWorkerCardHtml(issued)}</span></span></div><div class="date-block"><span class="date-icon">◷</span><span><span class="date-label">EXPIRY DATE</span><span class="date-value">${escapeWorkerCardHtml(expires)}</span></span></div><div class="serial"><div class="serial-label">${escapeWorkerCardHtml(branding.footerText)}</div><div class="serial-value">${escapeWorkerCardHtml(card.cardNumber)}</div></div></div>
    </main>${autoPrint ? '<script>window.onload=()=>{window.focus();window.print();}</script>' : ''}</body></html>`;
}

export function buildWorkerCardBatchPrintHtml({
  branding,
  cards,
  autoPrint = true,
}: WorkerCardBatchPrintInput) {
  if (cards.length === 0) throw new Error('At least one worker card is required.');

  const rendered = cards.map(item => buildWorkerCardPrintHtml({
    ...item,
    branding,
    autoPrint: false,
  }));
  const style = rendered[0].match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
  const sheets = rendered.map(document => {
    const match = document.match(/<main class="card"([^>]*)>([\s\S]*?)<\/main>/);
    if (!match) throw new Error('Worker card print layout could not be composed.');
    return `<main class="card card-sheet"${match[1]}>${match[2]}</main>`;
  }).join('');

  return `<!doctype html><html><head><meta charset="utf-8"><title>Worker card batch</title>
    <style>${style}.card-sheet{break-after:page;page-break-after:always}.card-sheet:last-child{break-after:auto;page-break-after:auto}</style>
    </head><body>${sheets}${autoPrint ? '<script>window.onload=()=>{window.focus();window.print();}</script>' : ''}</body></html>`;
}
