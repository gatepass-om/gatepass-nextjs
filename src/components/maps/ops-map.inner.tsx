'use client';

import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect } from 'react';
import {
  MapContainer,
  TileLayer,
  Circle,
  CircleMarker,
  Polygon,
  Polyline,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import type { MapTone, OpsMapProps } from './ops-map';

const TONE_HEX: Record<MapTone, string> = {
  primary: '#3b82f6',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  teal: '#14b8a6',
  muted: '#64748b',
};

function toneHex(tone?: MapTone) {
  return TONE_HEX[tone ?? 'primary'];
}

function FitBounds({ zones, points, enabled }: Pick<OpsMapProps, 'zones' | 'points'> & { enabled: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!enabled) return;
    const latlngs: [number, number][] = [];
    (zones ?? []).forEach((z) => {
      if (z.center) latlngs.push(z.center);
      (z.polygon ?? []).forEach((p) => latlngs.push(p));
    });
    (points ?? []).forEach((p) => latlngs.push(p.position));
    if (latlngs.length === 1) {
      map.setView(latlngs[0], 12, { animate: false });
    } else if (latlngs.length > 1) {
      map.fitBounds(L.latLngBounds(latlngs).pad(0.35), { maxZoom: 13, animate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(zones), JSON.stringify(points), enabled]);
  return null;
}

function ClickCapture({ onMapClick }: Pick<OpsMapProps, 'onMapClick'>) {
  useMapEvents({
    click(e) {
      onMapClick?.(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function OpsMapInner({
  zones = [],
  points = [],
  draft = null,
  center = [21, 57],
  zoom = 6,
  className,
  interactive = true,
  onMapClick,
  fit = true,
}: OpsMapProps) {
  return (
    <div className={className} style={{ position: 'relative', minHeight: 200, isolation: 'isolate' }}>
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom={interactive}
      dragging={interactive}
      doubleClickZoom={interactive}
      zoomControl={interactive}
      attributionControl
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        subdomains="abcd"
        maxZoom={20}
      />

      {fit && <FitBounds zones={zones} points={points} enabled={fit} />}
      {onMapClick && <ClickCapture onMapClick={onMapClick} />}

      {zones.map((zone) => {
        const color = toneHex(zone.tone);
        const opacity = zone.active === false ? 0.35 : 1;
        const pathOptions = {
          color,
          weight: 2,
          opacity,
          fillColor: color,
          fillOpacity: zone.active === false ? 0.04 : 0.12,
        };
        const label = (
          <Tooltip direction="top" opacity={1} sticky>
            <div className="text-xs">
              <div className="font-semibold">{zone.name}</div>
              {zone.meta && <div className="text-muted-foreground">{zone.meta}</div>}
            </div>
          </Tooltip>
        );
        if (zone.shape === 'Circle' && zone.center && zone.radiusMeters) {
          return (
            <Circle key={zone.id} center={zone.center} radius={zone.radiusMeters} pathOptions={pathOptions}>
              {label}
            </Circle>
          );
        }
        if (zone.polygon && zone.polygon.length >= 3) {
          return (
            <Polygon key={zone.id} positions={zone.polygon} pathOptions={pathOptions}>
              {label}
            </Polygon>
          );
        }
        return null;
      })}

      {points.map((point) => {
        const color = toneHex(point.tone);
        return (
          <CircleMarker
            key={point.id}
            center={point.position}
            radius={7}
            pathOptions={{ color, weight: 2, fillColor: color, fillOpacity: 0.9 }}
          >
            <Tooltip direction="top" opacity={1}>
              <div className="text-xs">
                <div className="font-semibold">{point.label}</div>
                {point.meta && <div className="text-muted-foreground">{point.meta}</div>}
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}

      {draft?.kind === 'circle' && draft.center && (
        <>
          <Circle
            center={draft.center}
            radius={Math.max(1, draft.radiusMeters)}
            pathOptions={{ color: '#38bdf8', weight: 2, dashArray: '6 6', fillColor: '#38bdf8', fillOpacity: 0.12 }}
          />
          <CircleMarker center={draft.center} radius={5} pathOptions={{ color: '#38bdf8', fillColor: '#38bdf8', fillOpacity: 1 }} />
        </>
      )}

      {draft?.kind === 'polygon' && draft.points.length > 0 && (
        <>
          {draft.points.length >= 3 ? (
            <Polygon positions={draft.points} pathOptions={{ color: '#38bdf8', weight: 2, dashArray: '6 6', fillColor: '#38bdf8', fillOpacity: 0.12 }} />
          ) : (
            <Polyline positions={draft.points} pathOptions={{ color: '#38bdf8', weight: 2, dashArray: '6 6' }} />
          )}
          {draft.points.map((p, i) => (
            <CircleMarker key={i} center={p} radius={4} pathOptions={{ color: '#38bdf8', fillColor: '#38bdf8', fillOpacity: 1 }} />
          ))}
        </>
      )}
    </MapContainer>
    </div>
  );
}
