
'use client'

import React from 'react';
import { useScanner } from '@/hooks/use-scanner';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CameraOff, ScanLine, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScannerPreviewProps {
  onScanSuccess: (decodedText: string) => void;
  isPaused: boolean;
}

export function ScannerPreview({ onScanSuccess, isPaused }: ScannerPreviewProps) {
  const { hasPermission, isScanning } = useScanner({ onScanSuccess, isPaused });

  return (
    <Card className="relative aspect-video bg-muted rounded-md overflow-hidden border">
      <div id="qr-scanner-container" className="w-full h-full" />
      {hasPermission === null && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground p-4 bg-background/90">
            <Loader2 className="h-10 w-10 animate-spin" />
            <span className="font-semibold">Initializing Camera...</span>
        </div>
      )}

      {hasPermission === false && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-destructive p-4 bg-background/90">
          <CameraOff className="h-10 w-10" />
          <span className="font-semibold">Camera Not Available</span>
          <p className="text-sm text-muted-foreground">Please grant camera permissions in your browser settings.</p>
        </div>
      )}

      {isScanning && hasPermission && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[250px] h-[250px] border-4 border-primary/50 rounded-lg" style={{ boxShadow: '0 0 0 9999px hsla(0, 0%, 0%, 0.5)' }} />
          <ScanLine className="absolute h-16 w-64 text-primary/70 animate-pulse" />
        </div>
      )}

       {hasPermission && !isScanning && !isPaused && (
         <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground p-4 bg-background/90">
            <Loader2 className="h-10 w-10 animate-spin" />
            <span className="font-semibold">Starting Scanner...</span>
        </div>
      )}

    </Card>
  );
}
