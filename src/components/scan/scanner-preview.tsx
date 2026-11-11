
'use client'

import React from 'react';
import { useScanner } from '@/hooks/use-scanner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CameraOff, ScanLine, Loader2 } from 'lucide-react';

interface ScannerPreviewProps {
  onScanSuccess: (decodedText: string) => void;
  isPaused: boolean;
  scanContext: string;
}

export function ScannerPreview({ onScanSuccess, isPaused, scanContext }: ScannerPreviewProps) {
  const { scannerId, status, error, retry } = useScanner({ onScanSuccess, isPaused, scanContext });

  return (
    <Card className={`relative aspect-video bg-muted rounded-md overflow-hidden border ${status === 'error' ? 'min-h-64' : ''}`}>
      <div id={scannerId} data-testid="qr-scanner-container" className="w-full h-full" />
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
          <ScanLine className="h-16 w-16 text-primary/70 animate-pulse" />
        </div>
      )}

    </Card>
  );
}
