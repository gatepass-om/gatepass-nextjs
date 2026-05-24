'use client'

import { useEffect, useRef, useState } from 'react';

interface UseScannerProps {
  onScanSuccess: (decodedText: string) => void;
  isPaused: boolean;
}

export function useScanner({ onScanSuccess, isPaused }: UseScannerProps) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const html5QrCodeRef = useRef<any | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
        setHasPermission(true);
      } catch (err) {
        console.error('Camera error', err);
        setHasPermission(false);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (hasPermission !== true) return;
    let cancelled = false;

    const runScanner = async () => {
      const { Html5Qrcode, Html5QrcodeScannerState } = await import('html5-qrcode');
      if (cancelled) return;

      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode('qr-scanner-container');
      }

      const qr = html5QrCodeRef.current;

      const startScanner = async () => {
        if (qr.getState() === Html5QrcodeScannerState.NOT_STARTED) {
          try {
            setIsScanning(true);
            await qr.start(
              { facingMode: 'environment' },
              { fps: 5 },
              (decodedText: string) => {
                console.log("QR code detected:", decodedText);
                onScanSuccess(decodedText);
              },
              () => undefined
            );
          } catch (err) {
            console.error('Scanner start error', err);
            setIsScanning(false);
          }
        }
      };

      const stopScanner = async () => {
        if (qr.getState() === Html5QrcodeScannerState.SCANNING) {
          try {
            await qr.stop();
            setIsScanning(false);
          } catch (err) {
            console.error("Error stopping scanner:", err);
          }
        }
      };

      if (!isPaused) {
        if (qr.getState() === Html5QrcodeScannerState.PAUSED) {
          qr.resume();
          setIsScanning(true);
        } else {
          startScanner();
        }
      } else {
        stopScanner();
      }
    };

    void runScanner();

    return () => {
      cancelled = true;
      void html5QrCodeRef.current?.stop?.().catch(() => undefined);
    };
  }, [isPaused, hasPermission, onScanSuccess]);

  return { hasPermission, isScanning };
}
