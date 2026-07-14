'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

export type MapTone = 'primary' | 'success' | 'warning' | 'danger' | 'teal' | 'muted';

export type OpsZone = {
  id: string;
  name: string;
  shape: 'Circle' | 'Polygon' | string;
  center?: [number, number] | null;
  radiusMeters?: number | null;
  polygon?: [number, number][];
  tone?: MapTone;
  meta?: string;
  active?: boolean;
};

export type OpsPoint = {
  id: string;
  position: [number, number];
  label: string;
  meta?: string;
  tone?: MapTone;
};

export type OpsMapDraft =
  | { kind: 'circle'; center: [number, number] | null; radiusMeters: number }
  | { kind: 'polygon'; points: [number, number][] }
  | null;

export type OpsMapProps = {
  zones?: OpsZone[];
  points?: OpsPoint[];
  draft?: OpsMapDraft;
  center?: [number, number];
  zoom?: number;
  className?: string;
  interactive?: boolean;
  onMapClick?: (lat: number, lng: number) => void;
  fit?: boolean;
};

// Leaflet touches `window`, so the actual map is loaded client-side only.
export const OpsMap = dynamic(() => import('./ops-map.inner').then((m) => m.OpsMapInner), {
  ssr: false,
  loading: () => (
    <div
      className="flex h-full w-full items-center justify-center rounded-xl border border-border/70 bg-card/60"
      style={{ minHeight: 280 }}
    >
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  ),
});
