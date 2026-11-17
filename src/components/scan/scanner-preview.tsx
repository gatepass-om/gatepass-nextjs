
'use client'

import React, { useEffect, useRef } from 'react';
import { useScanner } from '@/hooks/use-scanner';
import { scannerVideoLayout } from './scanner-config';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CameraOff, Loader2 } from 'lucide-react';

interface ScannerPreviewProps {
  onScanSuccess: (decodedText: string) => void;
  isPaused: boolean;
  scanContext: string;
}

export function ScannerPreview({ onScanSuccess, isPaused, scanContext }: ScannerPreviewProps) {
  const { scannerId, status, error, retry } = useScanner({ onScanSuccess, isPaused, scanContext });

  const cardRef = useRef<HTMLDivElement>(null);

  // Keep the reader's container at the sampling size (so it decodes real camera pixels) and scale it to the card.
  useEffect(() => {
    const card = cardRef.current;
    const container = document.getElementById(scannerId);
    if (!card || !container) return;
    const layout = () => {
      const video = container.querySelector('video');
      const next = scannerVideoLayout(card.clientWidth, card.clientHeight, video?.videoWidth ?? 0, video?.videoHeight ?? 0);
      container.style.width = `${next.width}px`;
      container.style.height = `${next.height}px`;
      container.style.transform = `translate(${next.left}px, ${next.top}px) scale(${next.scale})`;
    };
    layout();
    // Media events do not bubble; capture them so the size is right before the reader measures the video.
    container.addEventListener('loadedmetadata', layout, true);
    container.addEventListener('resize', layout, true);
    const observer = new ResizeObserver(layout);
    observer.observe(card);
    return () => {
      container.removeEventListener('loadedmetadata', layout, true);
      container.removeEventListener('resize', layout, true);
      observer.disconnect();
    };
  }, [scannerId]);

  return (
    <Card ref={cardRef} className={`relative aspect-[4/3] sm:aspect-video bg-black rounded-md overflow-hidden border ${status === 'error' ? 'min-h-64' : ''}`}>
      {/* The reader forces position:relative and its own video size inline; override both. */}
      <div id={scannerId} data-testid="qr-scanner-container" className="!absolute left-0 top-0 origin-top-left [&_video]:!h-full [&_video]:!w-full" />
      {status === 'starting' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground p-4 bg-background/90">
            <Loader2 className="h-10 w-10 animate-spin" />
            <span className="font-semibold" role="status">Starting camera…</span>
            <p className="text-sm text-center">Allow camera access if your browser asks.</p>
        </div>
      )}

      {status === 'error' && (
        <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-destructive p-4 bg-background/90 text-center">
          <CameraOff className="h-10 w-10" />
          <span className="font-semibold">Camera Not Available</span>
          <p className="w-full max-w-full whitespace-normal break-words text-sm text-muted-foreground">{error}</p>
          <Button type="button" variant="outline" onClick={retry}>Retry camera</Button>
        </div>
      )}

      {status === 'scanning' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="sr-only" role="status">Camera ready</span>
          <div className="relative aspect-square h-[62%] max-h-64 drop-shadow-[0_0_3px_rgba(0,0,0,0.8)]">
            <span className="absolute left-0 top-0 h-7 w-7 rounded-tl-lg border-l-4 border-t-4 border-white" />
            <span className="absolute right-0 top-0 h-7 w-7 rounded-tr-lg border-r-4 border-t-4 border-white" />
            <span className="absolute bottom-0 left-0 h-7 w-7 rounded-bl-lg border-b-4 border-l-4 border-white" />
            <span className="absolute bottom-0 right-0 h-7 w-7 rounded-br-lg border-b-4 border-r-4 border-white" />
            <span className="absolute inset-x-3 top-1/2 h-0.5 -translate-y-1/2 rounded bg-primary animate-pulse" />
          </div>
          <span className="absolute bottom-2 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white">Hold the QR inside the frame</span>
        </div>
      )}

    </Card>
  );
}
