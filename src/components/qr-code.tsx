
'use client';
import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";
// A lightweight QR code generator library that works well in browsers.
import QRCode from "qrcode";

export function QrCode({ value, className }: { value: string, className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && value) {
      QRCode.toCanvas(canvasRef.current, value, {
        width: 256,
        margin: 2,
        errorCorrectionLevel: 'H',
        color: {
            dark: '#0D1A2E', // Matches foreground
            light: '#FFFFFF' // Matches background
        }
      }, function (error) {
        if (error) console.error(error);
      });
    }
  }, [value]);

  if (!value) return null;

  return (
    <canvas ref={canvasRef} className={cn("w-full h-full", className)} />
  );
}
