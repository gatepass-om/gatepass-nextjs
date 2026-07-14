'use client';

import { useCallback } from 'react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

type WorkerBadgeProps = {
  name: string;
  subtitle?: string | null;
  workerCode?: string | null;
  /** The live QR credential token encoded on the badge. The scan re-checks compliance, so the print can't outlive it. */
  qrToken: string | null;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

/**
 * Renders a "Print badge" action that opens a self-contained, print-ready Nama Water worker badge (identity + the
 * live QR credential). The QR is rasterised to a data URL so it prints reliably across browsers.
 */
export function WorkerBadge({ name, subtitle, workerCode, qrToken }: WorkerBadgeProps) {
  const handlePrint = useCallback(async () => {
    if (!qrToken) return;
    const qrDataUrl = await QRCode.toDataURL(qrToken, { width: 256, margin: 1 });
    const printWindow = window.open('', '_blank', 'width=420,height=640');
    if (!printWindow) return;

    printWindow.document.write(`<!doctype html><html><head><title>Nama Water Badge — ${escapeHtml(name)}</title>
      <style>
        *{box-sizing:border-box}
        body{font-family:Inter,Arial,sans-serif;margin:0;padding:24px;display:flex;justify-content:center;background:#fff}
        .badge{width:320px;border:1px solid #d4d4d8;border-radius:16px;overflow:hidden}
        .hdr{background:#0b5fa5;color:#fff;padding:14px 18px;font-weight:700;letter-spacing:.06em;font-size:13px}
        .body{padding:18px;text-align:center}
        .name{font-size:20px;font-weight:700;margin:2px 0}
        .meta{color:#52525b;font-size:13px;margin:2px 0}
        .qr{margin:14px auto;width:200px;height:200px}
        .qr img{width:100%;height:100%;display:block}
        .foot{font-size:11px;color:#71717a;border-top:1px solid #e4e4e7;padding:10px;text-align:center}
      </style></head><body>
      <div class="badge">
        <div class="hdr">NAMA WATER · CONTRACTOR ACCESS</div>
        <div class="body">
          <div class="name">${escapeHtml(name)}</div>
          ${subtitle ? `<div class="meta">${escapeHtml(subtitle)}</div>` : ''}
          ${workerCode ? `<div class="meta">ID: ${escapeHtml(workerCode)}</div>` : ''}
          <div class="qr"><img src="${qrDataUrl}" alt="Worker QR credential"/></div>
          <div class="meta">Scan to verify live compliance</div>
        </div>
        <div class="foot">Verified by GatePass · gatepass.om</div>
      </div>
      <script>window.onload=function(){window.focus();window.print();}</script>
      </body></html>`);
    printWindow.document.close();
  }, [name, subtitle, workerCode, qrToken]);

  return (
    <Button variant="outline" size="sm" onClick={handlePrint} disabled={!qrToken}>
      <Printer className="mr-2 h-4 w-4" />
      Print badge
    </Button>
  );
}
