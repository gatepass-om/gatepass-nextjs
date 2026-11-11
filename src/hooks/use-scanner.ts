"use client";

import { useEffect, useId, useRef, useState } from 'react';
import type { Html5Qrcode } from 'html5-qrcode';
import { scannerCamera, scannerOptions } from '@/components/scan/scanner-config';

interface UseScannerProps {
  onScanSuccess: (decodedText: string) => void;
  isPaused: boolean;
  scanContext: string;
}

type ScannerStatus = 'starting' | 'scanning' | 'paused' | 'error';

export function useScanner({ onScanSuccess, isPaused, scanContext }: UseScannerProps) {
  const scannerId = `qr-scanner-${useId().replace(/:/g, '')}`;
  const [status, setStatus] = useState<ScannerStatus>('starting');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const controlRef = useRef<(() => void) | null>(null);
  const onScanSuccessRef = useRef(onScanSuccess);
  const pausedRef = useRef(isPaused);
  const lastDecodedRef = useRef('');
  const missingSinceRef = useRef<number | null>(null);

  useEffect(() => { onScanSuccessRef.current = onScanSuccess; }, [onScanSuccess]);
  useEffect(() => {
    lastDecodedRef.current = '';
    missingSinceRef.current = null;
  }, [scanContext]);
  useEffect(() => {
    pausedRef.current = isPaused;
    controlRef.current?.();
  }, [isPaused]);

  useEffect(() => {
    let cancelled = false;
    let starting = false;
    let scanner: Html5Qrcode | null = null;
    lastDecodedRef.current = '';
    missingSinceRef.current = null;
    setStatus('starting');
    setError('');

    const release = async () => {
      if (!scanner) return;
      try {
        if (scanner.isScanning) await scanner.stop();
      } catch { /* The browser may already have released the camera. */ }
      if (scannerRef.current === scanner) {
        scannerRef.current = null;
        controlRef.current = null;
        try { scanner.clear(); } catch { /* The preview may have unmounted. */ }
      }
    };

    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera scanning requires HTTPS or localhost in a browser with camera support.');
        }
        const { Html5Qrcode, Html5QrcodeScannerState: State } = await import('html5-qrcode');
        if (cancelled) return;
        const qr = new Html5Qrcode(scannerId);
        scanner = qr;
        scannerRef.current = qr;
        controlRef.current = () => {
          if (cancelled) return;
          if (pausedRef.current && qr.getState() === State.SCANNING) {
            qr.pause(true);
            setStatus('paused');
          } else if (!pausedRef.current && qr.getState() === State.PAUSED) {
            qr.resume();
            setStatus('scanning');
          }
        };
        starting = true;
        // The QR reader owns the only camera stream. A separate permission
        // probe leaks a stream and can prevent the rear camera from opening.
        await qr.start(scannerCamera, scannerOptions, (decodedText) => {
          if (cancelled || pausedRef.current) return;
          missingSinceRef.current = null;
          if (decodedText === lastDecodedRef.current) return;
          lastDecodedRef.current = decodedText;
          onScanSuccessRef.current(decodedText);
        }, () => {
          // A held badge is one scan. Removing it for a second permits a new
          // read of that badge; a different badge is recognized immediately.
          missingSinceRef.current ??= Date.now();
          if (Date.now() - missingSinceRef.current >= 1000) lastDecodedRef.current = '';
        });
        if (!cancelled) {
          setStatus('scanning');
          controlRef.current?.();
        }
      } catch (failure) {
        if (cancelled) return;
        console.error('Scanner startup failed', failure);
        // html5-qrcode wraps DOMException names in a string before rejecting.
        const detail = `${failure instanceof Error ? failure.name : ''} ${String(failure)}`;
        const message = /NotAllowedError|PermissionDeniedError/.test(detail)
          ? 'Camera access is blocked. Allow camera access for this site in your browser, then retry.'
          : /NotFoundError|DevicesNotFoundError/.test(detail)
            ? 'No camera was found. Connect a camera or paste the badge credential below.'
            : /NotReadableError|TrackStartError/.test(detail)
              ? 'The camera is busy or could not be opened. Close other camera apps, then retry.'
              : !navigator.mediaDevices?.getUserMedia
                ? 'Camera scanning requires HTTPS or localhost in a browser with camera support.'
                : 'The scanner could not start. Retry the camera, or paste the badge credential below.';
        setError(message);
        setStatus('error');
        await release();
      } finally {
        starting = false;
        // Startup may finish after navigation. Close that late camera stream.
        if (cancelled) await release();
      }
    };

    void start();
    return () => {
      cancelled = true;
      if (!starting) void release();
    };
  }, [attempt, scannerId]);

  return { scannerId, status, error, retry: () => setAttempt(value => value + 1) };
}
