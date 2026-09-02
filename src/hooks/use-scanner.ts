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
  const onScanSuccessRef = useRef(onScanSuccess);

  // The page supplies an inline callback. Keeping it in a ref prevents a render after
  // detection from tearing down the camera while html5-qrcode is still processing it.
  useEffect(() => {
    onScanSuccessRef.current = onScanSuccess;
  }, [onScanSuccess]);

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

  useEffect(() => () => {
    const scanner = html5QrCodeRef.current;
    if (!scanner) return;
    // This is the only permanent teardown. Do not stop during a scan result render.
    void scanner.stop?.().catch(() => undefined);
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
              {
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
              {
                // Whole-frame decoding at 5 fps is noticeably slow on iPhones. A
                // focused centre window at 12 fps gives near-instant badge reads.
                fps: 12,
                qrbox: { width: 280, height: 280 },
                disableFlip: true,
              },
              (decodedText: string) => {
                console.log("QR code detected:", decodedText);
                onScanSuccessRef.current(decodedText);
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
          } catch { /* The camera may already have been released by the browser. */ }
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
        // Pause retains the camera session and avoids the stop/start race after a QR
        // detection. It also resumes much faster for the next scan.
        if (qr.getState() === Html5QrcodeScannerState.SCANNING) {
          qr.pause(true);
          setIsScanning(false);
        }
      }
    };

    void runScanner();

    return () => {
      cancelled = true;
    };
  }, [isPaused, hasPermission]);

  return { hasPermission, isScanning };
}
